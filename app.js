/*
 * Copyright 2022 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const bodyParser = require('body-parser'); 
const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const serviceAccountFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || './solid-binder-371504-28022d092ac6.json';
const issuerId = process.env.WALLET_ISSUER_ID || '3388000000022179153';
const classId = process.env.WALLET_CLASS_ID || '44a44c65-1544-490b-a918-5c93c86a2b0e';

const PORT = process.env.PORT || 4000;
const ORIGINS = process.env.URL || 'http://localhost:4000';

router.get('/',(req,res)=>{

  res.json({ 'test':'t'})
})

async function createPassAndToken(req, res) {
  const credentials = require(serviceAccountFile);
  const httpClient = new GoogleAuth({
    credentials: credentials,
    scopes: 'https://www.googleapis.com/auth/wallet_object.issuer'
  });

  const objectUrl = 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject/';
  const objectPayload = require('./generic-pass.json');

  objectPayload.id = `${issuerId}.${req.body.email.replace(/[^\w.-]/g, '_')}-${classId}`;
  console.log('req.body.email', JSON.stringify(req.body.email));
  objectPayload.classId = `${issuerId}.${classId}`;

  let objectResponse;
  try {
    objectResponse = await httpClient.request({url: objectUrl + objectPayload.id, method: 'GET'});
    console.log('existing object', objectPayload.id);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      objectResponse = await httpClient.request({url: objectUrl, method: 'POST', data: objectPayload});
      console.log('new object', objectPayload.id);
    } else {
      console.error(err);
      throw err;
    }
  }

  // following code, which creates a JWT and sends the button HTML back to the web page:

  const claims = {
    iss: credentials.client_email, // `client_email` in service account file.
    aud: 'google',
    origins: [ORIGINS],
    typ: 'savetowallet',
    payload: {
      genericObjects: [{id: objectPayload.id}],
    },
  };
  
  const token = jwt.sign(claims, credentials.private_key, {algorithm: 'RS256'});
  const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

  res.status(200).send(saveUrl);
  // res.status(200).send(`<a href="${saveUrl}"><img src="button.png"></a>`);
  console.log(`${saveUrl}`);
}

const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));
app.post('/wallet', createPassAndToken);
app.listen(PORT,() => {
  console.log(`server is running at port no. ${PORT}`)
})