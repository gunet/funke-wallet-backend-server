import express, { Request, Response, Router } from 'express';
import { base64url } from 'jose';
import cbor from 'cbor';
import { IssuerSignedDocument } from '@auth0/mdl';

const utilsRouter: Router = express.Router();


utilsRouter.post('/mdl/parse', async (req, res) => {
	const { credential, doc_type } = req.body;
	const step1 =  base64url.decode(credential);
	const issuerSigned = await cbor.decode(step1)

	for (const ns of Object.keys(issuerSigned.nameSpaces)) {
		issuerSigned.nameSpaces[ns] = issuerSigned.nameSpaces[ns].map((tag) => {
			return {
				...cbor.decode(tag.value)
			}
		})
	}


	const issuerSignedDoc = new IssuerSignedDocument(doc_type, issuerSigned);
	const namespace = issuerSignedDoc.getIssuerNameSpace(doc_type);
	return res.send({ namespace });
})

export {
	utilsRouter
}