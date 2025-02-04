import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

export type Project = {
  framework?: string;
  css?: "CSS" | "Tailwind";
  withZephyr?: boolean;
  port?: number;
  name: string;
  type: "Application" | "Library" | "API";
};

type Profiler = {
  NAME: string;
  FRAMEWORK: string | undefined;
  SAFE_NAME: string;
  PORT?: number;
  CSS?: "Tailwind" | "Empty CSS";
  CONTAINER?: string;
};

const templateFile = (fileName: string, replacements: Profiler) => {
  const fileContent = fs.readFileSync(fileName, "utf8").toString();

  const template = Object.entries(replacements).reduce((acc, [key, value]) => {
    return acc.replace(
      new RegExp(`({{${key}}}|{{ ${key} }})`, "g"),
      value?.toString() ?? ""
    );
  }, fileContent);
  fs.writeFileSync(fileName, template);
};

// required for npm publish
const renameGitignore = (projectName: string) => {
  if (fs.existsSync(path.normalize(`${projectName}/gitignore`))) {
    fs.renameSync(
      path.normalize(`${projectName}/gitignore`),
      path.normalize(`${projectName}/.gitignore`)
    );
  }
};

const buildProfiler = ({ type, framework, name, css, port }: Project) => {
  const profiler: Profiler = {
    NAME: name,
    FRAMEWORK: framework,
    SAFE_NAME: name.replace(/-/g, "_").trim(),
  };

  if (type === "API" || type === "Application") {
    profiler.PORT = port;
  }

  if (type === "Application") {
    const isTailwind = css === "Tailwind";
    profiler.CONTAINER = isTailwind
      ? "mt-10 text-3xl mx-auto max-w-6xl"
      : "container";
    profiler.CSS = isTailwind ? "Tailwind" : "Empty CSS";
  }
  return profiler;
};

// I for the life of me, could not get ncp to copy the directory fast enough to
// get the template replacements handled properly.
// So I made this hand rolled function to do it
const copyDirSync = (sourceDir: string, targetDir: string) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir);

  files.forEach((file) => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      copyDirSync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
};

export const buildProject = async (project: Project) => {
  const { name, framework, type } = project;
  const tempDir = type.toLowerCase();
  const profiler = buildProfiler(project);

  if (type === "Application") {
    copyDirSync(
      path.join(__dirname, `../templates/${tempDir}/${framework}`),
      name
    );

    const pkg = fs.readFileSync(path.join(name, "package.json"), "utf8");
    const packageJSON = JSON.parse(pkg);
    packageJSON.devDependencies = packageJSON.devDependencies || {};

    if (project.css === "Tailwind") {
      await copyDirSync(
        path.join(__dirname, "../templates/application-extras/tailwind"),
        name
      );
      packageJSON.devDependencies["@tailwindcss/postcss"] = "^4.0.3";
      packageJSON.devDependencies["tailwindcss"] = "^4.0.3";
    }

    if (project.withZephyr && project.framework === "react-19" || project.framework === "react-18") {
      copyDirSync(
        path.join(__dirname, "../templates/application-extras/withZephyr"),
        name
      );
      packageJSON.dependencies["zephyr-rspack-plugin"] = "^0.0.32";
    }

    await fs.writeFileSync(
      path.join(name, "package.json"),
      JSON.stringify(packageJSON, null, 2)
    );
  }
  if (type === "Library") {
    await copyDirSync(
      path.join(__dirname, `../templates/${tempDir}/typescript`),
      name
    );
  }
  if (type === "API") {
    await copyDirSync(
      path.join(__dirname, `../templates/server/${framework}`),
      name
    );
  }

  renameGitignore(name);

  const files = glob.sync(`${name}/**/*`);
  for (const file of files) {
    if (fs.lstatSync(file).isFile()) {
      templateFile(file, profiler);
    }
  }
};
