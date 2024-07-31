import express, { Router } from "express";
import { getAllVerifiableCredentials, getVerifiableCredentialByCredentialIdentifier, deleteVerifiableCredential, createVerifiableCredential } from "../entities/VerifiableCredential.entity";
import { getAllVerifiablePresentations, getPresentationByIdentifier } from "../entities/VerifiablePresentation.entity";
import crypto from 'node:crypto';
import { getUserByDID } from "../entities/user.entity";
import { sendPushNotification } from "../lib/firebase";


const storageRouter: Router = express.Router();

storageRouter.post('/vc', storeCredential);
storageRouter.get('/vc', getAllVerifiableCredentialsController);
storageRouter.get('/vc/:credential_identifier', getVerifiableCredentialByCredentialIdentifierController);
storageRouter.delete('/vc/:credential_identifier', deleteVerifiableCredentialController);
storageRouter.get('/vp', getAllVerifiablePresentationsController);
storageRouter.get('/vp/:presentation_identifier', getPresentationByPresentationIdentifierController);


async function storeCredential(req, res) {
	const { format, doctype, vct, credential } = req.body;
	createVerifiableCredential({
		format,
		doctype,
		vct,
		credential,
		holderDID: req.user.did,
		credentialIdentifier: crypto.randomUUID(),
		issuerDID: "",
		issuerURL: "",
		logoURL: "",
		backgroundColor: "",
		issuanceDate: new Date(),
		issuerFriendlyName: ""
	}).then(async () => {
		// inform all installed instances of the wallet that a credential has been received
		const userRes = await getUserByDID(req.user.did);
		if (userRes.err) {
			return;
		}
		const user = userRes.unwrap();
		if (user.fcmTokenList) {
			for (const fcmToken of user.fcmTokenList) {
				sendPushNotification(fcmToken.value, "New Credential", "A new verifiable credential is in your wallet").catch(err => {
					console.log("Failed to send notification")
					console.log(err)
				});
			}
		}
	})
	res.send({});
}

async function getAllVerifiableCredentialsController(req, res) {
	const holderDID = req.user.did;
	console.log("Holder did", holderDID)
	const vcListResult = await getAllVerifiableCredentials(holderDID);
	if (vcListResult.err) {
		res.status(500).send({});
		return;
	}
	const vc_list = vcListResult.unwrap()
	.map((v) => {
		return {
			...v,
			issuanceDate: Math.floor(v.issuanceDate.getTime() / 1000)
		}
	});

	res.status(200).send({ vc_list: vc_list })

}

async function getVerifiableCredentialByCredentialIdentifierController(req, res) {
	const holderDID = req.user.did;
	const { credential_identifier } = req.params;
	const vcFetchResult = await getVerifiableCredentialByCredentialIdentifier(holderDID, credential_identifier);
	if (vcFetchResult.err) {
		return res.status(500).send({ error: vcFetchResult.val })
	}
	const vc = vcFetchResult.unwrap();
	const changedVC = { ...vc, issuanceDate: Math.floor(vc.issuanceDate.getTime() / 1000)}
	res.status(200).send(vc);
}

async function deleteVerifiableCredentialController(req, res) {
	const holderDID = req.user.did;
	const { credential_identifier } = req.params;
	const deleteResult = await deleteVerifiableCredential(holderDID, credential_identifier);
	if (deleteResult.err) {
		return res.status(500).send({ error: deleteResult.val });
	}
	res.status(200).send({ message: "Verifiable Credential deleted successfully." });
}



async function getAllVerifiablePresentationsController(req, res) {
	const holderDID = req.user.did;
	const vpListResult = await getAllVerifiablePresentations(holderDID);
	if (vpListResult.err) {
		res.status(500).send({});
		return;
	}
	const vp_list = vpListResult.unwrap()
	.map((v) => {
		return {
			...v,
			issuanceDate: Math.floor(v.issuanceDate.getTime() / 1000)
		}
	});
	res.status(200).send({ vp_list: vp_list })
}

async function getPresentationByPresentationIdentifierController(req, res) {
	const holderDID = req.user.did;
	const { presentation_identifier } = req.params;

	const vpResult = await getPresentationByIdentifier(holderDID, presentation_identifier);
	if (vpResult.err) {
		return res.status(500).send({ error: vpResult.val })
	}
	const vp = vpResult.unwrap();
	const changedVC = { ...vp, issuanceDate: Math.floor(vp.issuanceDate.getTime() / 1000)}
	res.status(200).send(vp);
}


export {
	storageRouter
}
