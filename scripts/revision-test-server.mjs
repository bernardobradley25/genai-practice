// Local-only test harness. The real API/validator runs against deterministic AI fixtures.
// No model call, account, API credit, or production data is used.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const api = spawn(process.execPath, [resolve(root, 'artifacts/api-server/dist/index.mjs')], {
  env: { ...process.env, PORT: '20369', AI_INTEGRATIONS_OPENAI_BASE_URL: 'http://127.0.0.1:20370/v1', AI_INTEGRATIONS_OPENAI_API_KEY: 'local-fixture-only' }, stdio: 'inherit',
});
const fixture = http.createServer(async (req, res) => {
  let body = ''; for await (const part of req) body += part;
  const input = JSON.parse(body);
  const text = input.messages.at(-1).content.toLowerCase();
  if (text.includes('qa burst')) await new Promise(resolve=>setTimeout(resolve,500));
  if (text.includes('slow reply')) {
    const timer = setTimeout(() => { if (!res.destroyed) { res.writeHead(503); res.end('{"error":{"message":"Slow fixture"}}'); } }, 15000);
    res.on('close', () => clearTimeout(timer));
    return;
  }
  if (text.includes('service failure')) { res.writeHead(503); res.end('{"error":{"message":"Fixture service unavailable"}}'); return; }
  let changes = [{ sessionId:'tue',sport:'Run',day:'Tuesday',time:'7:00 AM',title:'Easy run',detail:'35 min · conversational',status:'missed' }, { sessionId:'thu',sport:'Run',day:'Thursday',time:'6:30 PM',title:'Easy run',detail:'35 min · conversational',status:'moved' }];
  if (text.includes('strength') || text.includes('invalid') || text.includes('zero')) changes = [{ sessionId:'fri',sport:'Strength',day:'Wednesday',time:'7:15 PM',title:'Strength + mobility',detail:'40 min · moderate',status:'moved' }];
  if (text.includes('invalid')) { changes[0].day='Friday'; changes[0].time='25:99 PM'; }
  if (text.includes('zero')) { changes[0].day='Friday'; changes[0].detail='0 min'; }
  if (text.includes('after soccer')) { changes[0].time='8:30 PM'; }
  if (text.includes('swim')) changes=[{sessionId:'thu',sport:'Swim',day:'Thursday',time:'6:30 PM',title:'Easy swim',detail:'30 min · easy',status:'moved'}];
  if (text.includes('completed soccer')) changes=[{sessionId:'tue',sport:'Soccer',day:'Tuesday',time:'7:00 PM',title:'Soccer instead of run',detail:'90 min elapsed · 60 active · hard',status:'done'}];
  res.writeHead(200, {'Content-Type':'text/event-stream'});
  const send = (delta) => res.write(`data: ${JSON.stringify({choices:[{index:0,delta}]})}\n\n`);
  if(text.includes('qa empty')) {res.end('data: [DONE]\n\n');return;}
  if(text.includes('qa truncated text')) {send({content:'Incomplete coaching advice'});res.end();return;}
  if(text.includes('qa filtered')) {send({content:'Partial response'});res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:'content_filter'}]})}\n\n`);res.end('data: [DONE]\n\n');return;}
  if(text.includes('qa unknown tool')) {send({tool_calls:[{index:0,function:{name:'unexpected_tool',arguments:'{}'}}]});res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:'tool_calls'}]})}\n\n`);res.end('data: [DONE]\n\n');return;}
  if(text.includes('qa malformed tool')) {send({tool_calls:[{index:0,function:{name:'prepare_week_reflow',arguments:'{bad json'}}]});res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:'tool_calls'}]})}\n\n`);res.end('data: [DONE]\n\n');return;}
  send({content:'LOCAL TEST FIXTURE — this response is scripted to verify the interface and validator. '});
  if (input.tools) send({tool_calls:[{index:0,id:'fixture-call',type:'function',function:{name:'prepare_week_reflow',arguments:JSON.stringify({impact:'LOCAL TEST FIXTURE — review these changes. No live AI recommendation was generated.',changes:Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(id=>{const change=changes.find(item=>item.sessionId===id);if(!change)return [id,null];const {sessionId,...fields}=change;return [id,fields];}))})}}]});
  else if (text.includes('proposal status')) send({content: input.messages.slice(0, -1).filter(message => message.content.includes('Proposal status:')).map(message => message.content).join('\n') || 'No proposal context received.'});
  else send({content:'For a missed run, mark Tuesday missed and replace Thursday’s steady run with a 35-minute easy run at 6:30 PM. Do you like this plan?'});
  if(!text.includes('qa truncated tool'))res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:input.tools?'tool_calls':'stop'}]})}\n\n`);
  res.end('data: [DONE]\n\n');
}).listen(20370,'127.0.0.1');
const web = http.createServer(async (req,res) => {
  if (req.url.startsWith('/api/')) {
    const proxy=http.request({hostname:'127.0.0.1',port:20369,path:req.url,method:req.method,headers:req.headers}, reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
    proxy.on('error',()=>{if (!res.destroyed) {res.writeHead(503);res.end('API not ready');}});res.on('close',()=>{if (!res.writableEnded) proxy.destroy();});req.pipe(proxy);return;
  }
  const path=new URL(req.url,'http://localhost').pathname;
  const target=resolve(root,'artifacts/reflow-coach/dist/public','.'+path);
  if(!target.startsWith(resolve(root,'artifacts/reflow-coach/dist/public'))) {res.writeHead(403);res.end();return;}
  try {
    const file=path==='/'?resolve(target,'index.html'):target;
    const data=await readFile(file);
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream');res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(20368,'127.0.0.1',()=>console.log('LOCAL TEST FIXTURES at http://127.0.0.1:20368'));
function stop(){web.close();fixture.close();api.kill();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
