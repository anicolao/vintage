// Test process only. Never packaged with deployed Functions.
import {createServer} from 'node:http';
export function startAiServer() {
  const server=createServer(async(req,res)=>{
    if(req.method==='GET') {
      const url=new URL(req.url,'http://127.0.0.1');
      const data=[20,25,30].map((amount,i)=>({id:`test-sale-${i}`,title:'Test garment',condition:'Used',format:'fixed_price',link:`https://www.ebay.co.uk/itm/test-sale-${i}`,sold_date:new Date().toISOString().slice(0,10),best_offer_accepted:false,displayed_price:{amount,currency:'GBP'}}));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'complete',request_id:'test-job',credits:1,result:{provider:'ebay',country:'uk',query:url.searchParams.get('q'),page:1,schema_version:2,collected_at:new Date().toISOString(),data,next_page:null}}));return;
    }
    let body='';for await(const chunk of req)body+=chunk;
    const request=JSON.parse(body);const input=JSON.parse(request.contents[0].parts[0].text);
    let result;
    if(input.evidence)result={matches:input.evidence.map(e=>({evidenceId:e.evidenceId,reason:'Test comparable condition and type.'})),caution:'Test evidence only.'};
    else if(input.item)result={query:'test garment'};
    else if(input.copy)result={title:input.copy.title,description:`Revised wording: ${input.copy.description}`};
    else {
      const copy={title:'Test garment',description:input.languageInstructions.length?'Draft with remembered feedback.':'Draft from test photo.',category:'Clothing',brand:'',size:'',colour:'',material:'',condition:''};
      result={copy,confidence:Object.fromEntries(Object.keys(copy).map(k=>[k,0.5])),observations:[{text:'Test photo observation.',photoIds:[input.photoIds[0]]}]};
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({modelVersion:'test-only',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}));
  });
  return new Promise(resolve=>server.listen(9399,'127.0.0.1',()=>resolve(server)));
}
