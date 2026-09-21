// Test process only. Never packaged with deployed Functions.
import {createServer} from 'node:http';
export function startAiServer() {
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const request=JSON.parse(body);const input=JSON.parse(request.contents[0].parts[0].text);
    let result;
    if(input.copy)result={title:input.copy.title,description:`Revised wording: ${input.copy.description}`};
    else {
      const copy={title:'Test garment',description:input.languageInstructions.length?'Draft with remembered feedback.':'Draft from test photo.',category:'Clothing',brand:'',size:'',colour:'',material:'',condition:''};
      result={copy,confidence:Object.fromEntries(Object.keys(copy).map(k=>[k,0.5])),observations:[{text:'Test photo observation.',photoIds:[input.photoIds[0]]}]};
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({modelVersion:'test-only',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}));
  });
  return new Promise(resolve=>server.listen(9399,'127.0.0.1',()=>resolve(server)));
}
