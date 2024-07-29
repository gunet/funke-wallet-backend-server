import express, { Request, Response, Router } from 'express';
import { base64url } from 'jose';
import cbor from 'cbor';
import { MDoc, parse } from '@auth0/mdl';
import config from '../../config';
import * as jose from 'jose';
import * as webcrypto from 'uncrypto';


const importCert = async (cert) => {
	// convert issuer cert to KeyLike
	const issuerCertJose = await jose.importX509(cert, 'ES256', { extractable: true});
	// convert issuer cert from KeyLike to JWK
	const issuerCertJwk = await jose.exportJWK(issuerCertJose)
	// import issuer cert from JWK to CryptoKey
	const importedCert = await webcrypto.subtle.importKey('jwk',
		issuerCertJwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['verify']
	);

	console.log("Imported cert = ", importedCert)
	return importedCert;
}

const verifyMdocWithAllCerts = async (mdoc: MDoc) => {
	const issuerAuth = mdoc.documents[0].issuerSigned.issuerAuth;
	const results = await Promise.all(config.trustedCerts.map(async (cert: string) => {
		cert = cert.trim();
		try {
			return issuerAuth.verify(await importCert(cert));
		}
		catch(err) {
			console.error(err)
			return false;
		}
	})) as boolean[];

	const verifiedWithAtleastOneCert = results.find((v) => v == true);
	return verifiedWithAtleastOneCert == true;
}


const utilsRouter: Router = express.Router();

const parseMsoMdocCredential = async (mso_mdoc_cred, docType) => {
  const credentialBytes = base64url.decode(mso_mdoc_cred);
  const issuerSigned = await cbor.decode(credentialBytes);
  const m = {
    version: '1.0',
    documents: [new Map([
      ['docType', docType],
      ['issuerSigned', issuerSigned]
    ])],
    status: 0
  }
  const encoded = await cbor.encode(m);
  return parse(encoded);
}

function convertToJSONWithMaps(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value instanceof Map) {
      const obj = {};
      for (let [k, v] of value) {
        obj[k] = v;
      }
      return obj;
    }
    return value;
  }));
}

utilsRouter.post('/mdl/parse', async (req, res) => {
	const { credential, doctype } = req.body;
	const parsed = await parseMsoMdocCredential(credential, doctype);
	const result = await verifyMdocWithAllCerts(parsed);
	const ns = parsed.documents[0].getIssuerNameSpace(doctype);
	res.send({ namespace: convertToJSONWithMaps(ns), verificationStatus: result })
})

export {
	utilsRouter
}