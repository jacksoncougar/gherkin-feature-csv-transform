import * as matter from "gray-matter";
import * as stringify from "csv-stringify";
import * as vscode from "vscode";

import { Readable, pipeline } from "stream";

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
      } catch (e) {
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
      bdd: bdd,
    });

    testCaseNumber++;
  }
  return columnData;
}

function createVirtualDocumentHandler() {
  const myProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return decodeURIComponent(uri.fragment);
    }
  })();

  vscode.workspace.registerTextDocumentContentProvider("csv", myProvider);
}

function openPreviewDocument(jiraId: any, csv: string) {
  const filename = `${jiraId}tdd.csv`.replace(/[^\d\w]/, "");

  let uri = vscode.Uri.parse(`csv:///${filename}#${encodeURIComponent(csv)}`);

  vscode.workspace.openTextDocument(uri).then((doc) => {
    vscode.window.showTextDocument(doc);
    vscode.languages.setTextDocumentLanguage(doc, "csv");
  });
}

export function deactivate() {}
