import mammoth from "mammoth";
const filepath = process.argv[2];
if (!filepath) process.exit(1);
mammoth.extractRawText({path: filepath})
    .then(function(result){
        console.log(result.value); 
    })
    .catch(console.error);
