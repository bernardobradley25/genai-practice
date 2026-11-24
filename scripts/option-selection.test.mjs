import test from 'node:test';
import assert from 'node:assert/strict';
import {hasClearReflowIntent} from '../artifacts/api-server/src/lib/reflow-contract.ts';
const options={role:'assistant',content:'1. Accept the missed Tuesday easy run; keep Wednesday soccer, Thursday steady run and Saturday long run unchanged.\n2. Mark Tuesday missed and shorten Thursday to 30 minutes at its current time.\nI recommend option 1: accept the missed easy run and preserve the remaining structure. Do you like this plan?'};
for(const text of ['option 1 then','1','2 please','option one','the first one','the second option please',"I'll take option 2",'go with option 2','I choose option 1','number two','Let’s go with the first one.','I am settled on option 1']) {
 test(`selected option stages review: ${text}`,()=>assert.equal(hasClearReflowIntent([options,{role:'user',content:text}]),true));
}
for(const text of ['maybe option 1','option 1 or 2','option 1?','not option 1','option 1 but I am not sure','what would option 1 change?','compare option 1 and 2','option 3','I choose option 9','1 out of 10','I choose option 1 except Thursday','I am still deciding']) {
 test(`unresolved or unavailable choice stays discussion: ${text}`,()=>assert.equal(hasClearReflowIntent([options,{role:'user',content:text}]),false));
}
test('number without options does not authorize a plan',()=>assert.equal(hasClearReflowIntent([{role:'assistant',content:'How tired are you from 1 to 10?'},{role:'user',content:'1'}]),false));
test('unrelated numbered list does not authorize a plan',()=>assert.equal(hasClearReflowIntent([{role:'assistant',content:'1. Email\n2. Phone\nWhich do you prefer?'},{role:'user',content:'option 1 then'}]),false));
test('a new question does not revive stale options',()=>assert.equal(hasClearReflowIntent([options,{role:'user',content:'How tired should I feel?'},{role:'assistant',content:'How tired are you from 1 to 10?'},{role:'user',content:'1'}]),false));
test('markdown option headings are supported',()=>assert.equal(hasClearReflowIntent([{role:'assistant',content:'**Option 1:** Mark Tuesday missed.\n**Option 2:** Shorten Thursday to 30 minutes.'},{role:'user',content:'option 2 then'}]),true));
