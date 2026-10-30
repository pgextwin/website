import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const routes = new Map([
  ["/en/", "en/index.html"],
  ["/ja/", "ja/index.html"],
  ["/en/cli.html", "en/cli.html"],
  ["/ja/cli.html", "ja/cli.html"],
  ["/metadata/issue311-r09-nonpublishing-preview.json", "metadata/issue311-r09-nonpublishing-preview.json"]
]);

test("R09-01 exact-key EN/JA and CLI loopback HTTP preview: no public Pages write", async () => {
  const server = createServer(async (req, res) => {
    const file = routes.get(new URL(req.url, "http://127.0.0.1").pathname);
    if (!file) { res.writeHead(404); res.end(); return; }
    const body = await readFile(new URL(file, root));
    res.writeHead(200, {"content-type": file.endsWith(".json") ? "application/json" : "text/html; charset=utf-8"});
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const base = "http://127.0.0.1:" + address.port;
    const request = async (route) => {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      return response.text();
    };
    const evidence = JSON.parse(await request("/metadata/issue311-r09-nonpublishing-preview.json"));
    assert.equal(evidence.sourceRequestSha256, "174b48df34a82ef147b599b1b33a86964990ea6ee4fb6932b365e338dd23410f");
    assert.equal(evidence.originalStateBlobSha, "e588b93f5f607dc05e240e07c3351d75e1f34727");
    assert.equal(evidence.decision, "PUBLISH_DENY");
    assert.equal(evidence.websitePublishAuthorized, false);
    for (const lang of ["en", "ja"]) {
      const home = await request("/" + lang + "/");
      const cli = await request("/" + lang + "/cli.html");
      assert.match(home, new RegExp('<html lang="' + lang + '">'));
      assert.match(home, /cli/i);
      assert.match(cli, /pgextwin[.]exe/);
      assert.doesNotMatch(home + cli, /NONPUBLISHING_PR_PREVIEW_ONLY|174b48df34a82ef147b599b1b33a86964990ea6ee4fb6932b365e338dd23410f/);
    }
    assert.equal((await fetch(base + "/__not_an_approved_page__")).status, 404);
    console.log("R09_LOCAL_LOOPBACK_EN_JA_CLI_HTTP_PASS; PR_ONLY; PUBLISH_DENY");
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
