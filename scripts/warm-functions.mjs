// Process warmup is outside timed browser scenarios. It never uses a live project.
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8280')throw new Error('Local emulators required');
const result=await fetch('http://127.0.0.1:5001/demo-vintage/europe-west1/submitCommand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{}})});
if(result.status!==401)throw new Error('Callable auth boundary did not reject anonymous warmup');
