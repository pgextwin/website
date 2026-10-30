import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const proposal=JSON.parse(read("metadata/issue311-r09-nonpublishing-preview.json"));

test("R09 genuine accepted App source pin and public-write denial",()=>{
  assert.equal(proposal.schemaVersion,1);
  assert.equal(proposal.status,"NONPUBLISHING_PR_PREVIEW_ONLY");
  assert.equal(proposal.decision,"PUBLISH_DENY");
  assert.equal(proposal.catalogProtectedMainSha,"dc8390fd816aa7bf0bf3b541e822b1320a47846e");
  assert.equal(proposal.websiteBaseSha,"2eb3bd618f230cea424b99dac5148ca72d923cd7");
  assert.equal(proposal.sourceRequestSha256,"174b48df34a82ef147b599b1b33a86964990ea6ee4fb6932b365e338dd23410f");
  assert.equal(proposal.originalStateBlobSha,"e588b93f5f607dc05e240e07c3351d75e1f34727");
  assert.equal(proposal.r09BuildRunId,41082159167);
  assert.equal(proposal.r09ArtifactId,12989134273);
  assert.equal(proposal.r09ActualZipSha256,"a6a9e5a02d45eb4dd71419726c8e1a55c701b9e4befa6935e7e3d7e8db698cb6");
  for(const key of ["catalogRecordUpdateAuthorized","feedPublicReleaseAuthorized","websitePublishAuthorized","publisherTokenRequested","runtimeEnabled"]){
    assert.equal(proposal[key],false,key);
  }
});

test("EN JA current published site remains unmodified while private proposal is denied",()=>{
  assert.deepEqual(proposal.languages,["en","ja"]);
  assert.equal(proposal.catalogHistoricalPublicReleaseTag,"v4.16.13-windows.1");
  assert.match(read("app.js"),/https:\/\/raw\.githubusercontent\.com\/pgextwin\/catalog\/main/);
  assert.match(read("catalog-view.js"),/validateCatalogRecord/);
  for(const lang of proposal.languages){
    const home=read(lang+"/index.html");
    const cli=read(lang+"/cli.html");
    assert.match(home,new RegExp('<html lang="'+lang+'">'));
    assert.match(cli,new RegExp('<html lang="'+lang+'">'));
    assert.match(cli,/pgextwin\.exe/);
    assert.match(home,/cli/i);
    assert.doesNotMatch(home,/NONPUBLISHING_PR_PREVIEW_ONLY/);
    assert.doesNotMatch(cli,/NONPUBLISHING_PR_PREVIEW_ONLY/);
  }
  assert.match(read("scripts/published-cli-contract.mjs"),/verifyPublishedCli/);
});
