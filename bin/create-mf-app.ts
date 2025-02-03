#!/usr/bin/env node
import {
  intro,
  outro,
  text,
  isCancel,
  cancel,
  select,
  spinner,
} from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { program } from "commander";

import { buildProject, Project, } from "../src";

program
  .option("-t, --type <type>", "The type of project to create")
  .option("-f, --framework <framework>", "The framework to use")
  .option("-p, --port <number>", "The port to use")
  .option("-c, --css <css>", "The CSS framework to use (CSS or Tailwind)")
  .argument("<string>");

program.parse();

const options = program.opts();

function checkCancel(value: string | symbol) {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

(async () => {
  intro("Create Module Federation App (create-mf-app) V2");

  const answers: Project = {
    name: "",
    type: "Application"
  };

  if(program.args?.[0]) {
    answers.name = program.args?.[0];
  } else {
    answers.name = (await text({
      message: "What is the name of your app?",
      placeholder: "my-awesome-app"
    })) as string;
    checkCancel(answers.name);
  }

  if(options.type) {
    answers.type = options.type;
  } else {
    answers.type = (await select({
      message: "Pick a project type.",
      options: [
        { value: "Application", label: "Application" },
        { value: "API Server", label: "API Server" },
        { value: "Library", label: "Library" }
      ]
    })) as typeof answers.type;
  checkCancel(answers.type);
}

  if (answers.type === "Application" || answers.type === "API Server") {
    const templates = fs
      .readdirSync(
        path.join(
          __dirname,
          answers.type === "Application"
            ? "../templates/application"
            : "../templates/server"
        )
      )
      .sort();

    if(options.port) {
      answers.port = Number(options.port);
    } else {  
      const port = (await text({
        message: "Port number?",
        initialValue: "8080"
      })) as string;
      checkCancel(port);
      answers.port = Number(port);
    }

    if(options.framework) {
      answers.framework = options.framework;
    } else {
      answers.framework = (await select({
        message: "Framework?",
        options: templates.map((template) => ({
          value: template,
          label: template
        })),
        initialValue: answers.type === "Application" ? "react" : "express"
      })) as string;
      checkCancel(answers.framework);
    }

    if (answers.type === "Application") {
      if(options.css) {
        answers.css = options.css;
      } else {  
        answers.css = (await select({
          message: "CSS?",
          options: [
            { value: "CSS", label: "CSS" },
            { value: "Tailwind", label: "Tailwind" }
          ],
          initialValue: "Tailwind"
        })) as "CSS" | "Tailwind";
        checkCancel(answers.css);
      }
    }
  }

  const s = spinner();
  s.start("Building project...");
  buildProject({
    ...answers
  });
  s.stop("Project built.");

  outro(`Your '${answers.name}' project is ready to go. Next steps:

cd ${answers.name}
pnpm i
pnpm start
`);
})();
