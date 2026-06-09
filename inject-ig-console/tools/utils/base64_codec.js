const args = process.argv.slice(2);

if (args.length < 1) {
    console.log("[-] Uso: node base64_codec.js <string_ou_payload>");
    process.exit(1);
}

const input = args[0];
console.log(`\x1b[36m[+]\x1b[0m Ferramenta Utilitária: Base64 Codec`);
console.log(`[*] Input Original: ${input}\n`);

// Try to decode first to see if it's valid base64
let decoded = "";
let isBase64 = false;

// Simple heuristic: if it matches base64 regex and length is multiple of 4
if (/^[A-Za-z0-9+/]*={0,2}$/.test(input) && (input.length % 4 === 0) && input.length > 0) {
    try {
        decoded = Buffer.from(input, 'base64').toString('utf8');
        // if it decoded to printable ascii mostly
        if (/^[\x20-\x7E]*$/.test(decoded) && decoded.length > 0) {
            isBase64 = true;
        }
    } catch(e) {}
}

if (isBase64) {
    console.log(`\x1b[32m[DECODE DETECTADO]\x1b[0m O input parece ser Base64.`);
    console.log(`  -> Resultado Decoded: \x1b[33m${decoded}\x1b[0m`);
} else {
    const encoded = Buffer.from(input).toString('base64');
    console.log(`\x1b[32m[ENCODE]\x1b[0m O input foi codificado para Base64.`);
    console.log(`  -> Resultado Encoded: \x1b[33m${encoded}\x1b[0m`);
}

console.log(`\n[*] Operação finalizada com sucesso.`);
