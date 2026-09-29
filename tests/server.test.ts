import { beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type OpenAI from 'openai';
import { extract } from '../lib/intent.server';
import { handle, allowsOrigin } from '../lib/http.server';
const mockClient=(parse:ReturnType<typeof vi.fn>)=>({responses:{parse}} as unknown as OpenAI);
it.each(['refusal','incomplete','malformed','timeout','401','429'])('LLM %s fails closed',async scenario=>{
 const parse=vi.fn();
 if(['timeout','401','429'].includes(scenario))parse.mockRejectedValue(new Error(scenario));
 else parse.mockResolvedValue({status:scenario==='incomplete'?'incomplete':'completed',output_parsed:scenario==='malformed'?{status:'ready'}:null});
 await expect(extract('swap half my ETH for USDC',mockClient(parse))).rejects.toThrow();expect(parse).toHaveBeenCalledOnce();
});
const schema=z.object({text:z.string()}).strict();
const req=(body:string,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000/api/intent',{method:'POST',headers:{origin,host:'127.0.0.1:3000','content-type':'application/json'},body});
it('rejects wrong origin and oversized payload without reaching model',async()=>{const fn=vi.fn();expect((await handle(req('{}','http://evil.test'),'intent',schema,fn)).status).toBe(403);expect((await handle(req(JSON.stringify({text:'x'.repeat(2100)})),'intent',schema,fn)).status).toBe(413);expect(fn).not.toHaveBeenCalled();});
it('rejects extra request fields',async()=>{const fn=vi.fn();expect((await handle(req('{"text":"swap","recipient":"other"}'),'intent',schema,fn)).status).toBe(400);expect(fn).not.toHaveBeenCalled();});
it('allows only one concurrent operation',async()=>{let done:(v:unknown)=>void=()=>{};const fn=vi.fn(()=>new Promise(resolve=>{done=resolve;}));const first=handle(req('{"text":"swap"}'),'quote',schema,fn);await vi.waitFor(()=>expect(fn).toHaveBeenCalledOnce());expect((await handle(req('{"text":"swap"}'),'quote',schema,fn)).status).toBe(429);done({ok:true});expect((await first).status).toBe(200);});

it('accepts the configured browser Origin/Host despite an internal server URL',async()=>{const request=new Request('http://localhost:3000/api/quote',{method:'POST',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','content-type':'application/json'},body:'{"text":"swap"}'});expect((await handle(request,'quote',schema,async()=>({ok:true}))).status).toBe(200);});
it('rejects mismatched Host even with an allowed Origin',async()=>{const request=req('{"text":"swap"}');request.headers.set('host','evil.test');const fn=vi.fn();expect((await handle(request,'quote',schema,fn)).status).toBe(403);expect(fn).not.toHaveBeenCalled();});

it.each(['http://127.0.0.1:3000','http://localhost:3000'])('accepts same-origin preview alias %s', origin => {
 const request=new Request(origin+'/api/intent',{headers:{origin,host:new URL(origin).host}});
 expect(allowsOrigin(request,'http://127.0.0.1:3000')).toBe(true);
});
it.each(['http://evil.test:3000','http://localhost:3001','https://localhost:3000','null','http://localhost.evil.test:3000'])('rejects unconfigured origin %s', origin => {
 const request=new Request('http://127.0.0.1:3000/api/intent',{headers:{origin,host:origin==='null'?'127.0.0.1:3000':new URL(origin).host}});
 expect(allowsOrigin(request,'http://127.0.0.1:3000')).toBe(false);
});
