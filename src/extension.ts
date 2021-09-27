import * as matter from "gray-matter";
import * as stringify from "csv-stringify";
import * as vscode from "vscode";

import { Readable, pipeline } from "stream";

import { Provider } from "./Provider";

const provider = new Provider();

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "gherkin-feature-csv-transform.exportToZephyrCsv",
    () => {
      const text = vscode.window.activeTextEditor?.document.getText();

      try {
        const { scenarioMatches, jiraId } = readFeature(text);

        let columnData = extractColumnData(scenarioMatches, jiraId);

        createVirtualDocumentHandler();

        pipeline(
          Readable.from(columnData, { objectMode: true }),
          stringify(
            {
              header: true,
              columns: { name: "Name", bdd: "Test Script (BDD)" },
            },
            (_, csv) => {
              openPreviewDocument(jiraId, csv);
            }
          ),
          (err) => {
            if (err) {
              vscode.window.showErrorMessage(`${err}`);
            }
          }
        );
      } catch (e: any) {
        vscode.window.showErrorMessage(e.message);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function readFeature(text: string | undefined) {
  const { scenarioMatches, jiraId } = readFeatureImpl(text);

  if (scenarioMatches == null) {
    throw new Error("Could not find scenarios in text");
  }

  if (jiraId == null) {
    throw new Error("Could not find jira-id in frontmatter");
  }

  return { scenarioMatches, jiraId };
}

function readFeatureImpl(text: string | undefined) {
  const fm = matter(text ?? "");

  // remove whitespace and comments
  fm.content = fm.content?.replace(/\s*#.*|^\s+(\r?\n)/gm, "");

  const scenarioMatches = fm.content?.match(
    /Scenario:[\s\S]*?(?=Scenario:|$)/g
  );
  const jiraId = fm.data["jira-id"];
  return { scenarioMatches, jiraId };
}

function extractColumnData(matches: RegExpMatchArray | null, jiraId: string) {
  let testCaseNumber = 1;
  let columnData = [];

  for (var s of matches ?? []) {
    const extractions =
      /Scenario:(.*)(?:\r\n|\r|\n)([\s\S]*?)(?=Scenario:|$)/g.exec(s);

    const name = extractions?.[1];
    const bdd = extractions?.[2];

    columnData.push({
      name: `${jiraId} - TC${testCaseNumber} - ${name}`,
      bdd: alignMargin(bdd ?? ""),
    });

    testCaseNumber++;
  }
  return columnData;  
}

export let values = new Map();

function alignMargin(strings: string) {
  let lines = strings.trimEnd().split(/\r?\n/);
  let margin = Math.min(...lines.map((line) => countWhitespacePrefix(line)));
  
  return lines.map((line) => trimMargin(line, margin)).join("\n");
}

function countWhitespacePrefix(line: string) {
  let count = 0;
  for (var c of line) {
    if (!/\s/.test(c)) {
      break;
    }
    count++;
  }
  return count;
}

function trimMargin(line: string, margin: number) {
  return line.substring(margin, line.length);
}

function createVirtualDocumentHandler() {
  vscode.workspace.registerTextDocumentContentProvider("csv", provider);
}

function openPreviewDocument(jiraId: any, csv: string) {
  const filename = `${jiraId}tdd.csv`.replace(/[^\d\w]/, "");
  let uri = vscode.Uri.parse(`csv:///${filename}`);
  values.set(uri.path, csv);

  provider.onDidChangeEmitter.fire(uri);

  vscode.workspace.openTextDocument(uri).then((doc) => {
    vscode.window.showTextDocument(doc);
    vscode.languages.setTextDocumentLanguage(doc, "csv");
  });
}

export function deactivate() {}
