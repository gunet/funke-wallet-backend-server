import axios from 'axios';
import express, { Request, Response, Router } from 'express';
const proxyRouter: Router = express.Router();

proxyRouter.post('/', async (req, res) => {
    const { headers, method, url, data } = req.body;
    try {
        const response = await axios({
            url: url,
            headers: headers,
            method: method,
            data: data
        });
        res.status(200).send({
            status: response.status,
            headers: response.headers,
            data: response.data,
        })
    }
    catch(err) {
        console.error(err.response.data)
        res.status(400).send({ err: err.response.data });
    }

})

export {
    proxyRouter
}