'use strict';
const shim = require('fabric-shim');
const util = require('util');

/************************************************************************************************
 * 
 * GENERAL FUNCTIONS 
 * 
 ************************************************************************************************/

/**
 * Executes a query using a specific key
 * 
 * @param {*} key - the key to use in the query
 */
async function queryByKey(stub, key) {
  console.log('============= START : queryByKey ===========');
  console.log('##### queryByKey key: ' + key);

  let resultAsBytes = await stub.getState(key); 
  if (!resultAsBytes || resultAsBytes.toString().length <= 0) {
    throw new Error('##### queryByKey key: ' + key + ' does not exist');
  }
  console.log('##### queryByKey response: ' + resultAsBytes);
  console.log('============= END : queryByKey ===========');
  return resultAsBytes;
}

/**
 * Executes a query based on a provided queryString
 * 
 * I originally wrote this function to handle rich queries via CouchDB, but subsequently needed
 * to support LevelDB range queries where CouchDB was not available.
 * 
 * @param {*} queryString - the query string to execute
 */
async function queryByString(stub, queryString) {
  console.log('============= START : queryByString ===========');
  console.log("##### queryByString queryString: " + queryString);

  // CouchDB Query
  // let iterator = await stub.getQueryResult(queryString);

  // Equivalent LevelDB Query. We need to parse queryString to determine what is being queried
  // In this chaincode, all queries will either query ALL records for a specific docType, or
  // they will filter ALL the records looking for a specific NGO, Donor, Donation, etc. So far, 
  // in this chaincode there is a maximum of one filter parameter in addition to the docType.
  let docType = "";
  let startKey = "";
  let endKey = "";
  let jsonQueryString = JSON.parse(queryString);
  if (jsonQueryString['selector'] && jsonQueryString['selector']['docType']) {
    docType = jsonQueryString['selector']['docType'];
    startKey = docType + "0";
    endKey = docType + "z";
  }
  else {
    throw new Error('##### queryByString - Cannot call queryByString without a docType element: ' + queryString);   
  }

  let iterator = await stub.getStateByRange(startKey, endKey);

  // Iterator handling is identical for both CouchDB and LevelDB result sets, with the 
  // exception of the filter handling in the commented section below
  let allResults = [];
  while (true) {
    let res = await iterator.next();

    if (res.value && res.value.value.toString()) {
      let jsonRes = {};
      console.log('##### queryByString iterator: ' + res.value.value.toString('utf8'));

      jsonRes.Key = res.value.key;
      try {
        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
      } 
      catch (err) {
        console.log('##### queryByString error: ' + err);
        jsonRes.Record = res.value.value.toString('utf8');
      }
      // ******************* LevelDB filter handling ******************************************
      // LevelDB: additional code required to filter out records we don't need
      // Check that each filter condition in jsonQueryString can be found in the iterator json
      // If we are using CouchDB, this isn't required as rich query supports selectors
      let jsonRecord = jsonQueryString['selector'];
      // If there is only a docType, no need to filter, just return all
      console.log('##### queryByString jsonRecord - number of JSON keys: ' + Object.keys(jsonRecord).length);
      if (Object.keys(jsonRecord).length == 1) {
        allResults.push(jsonRes);
        continue;
      }
      for (var key in jsonRecord) {
        if (jsonRecord.hasOwnProperty(key)) {
          console.log('##### queryByString jsonRecord key: ' + key + " value: " + jsonRecord[key]);
          if (key == "docType") {
            continue;
          }
          console.log('##### queryByString json iterator has key: ' + jsonRes.Record[key]);
          if (!(jsonRes.Record[key] && jsonRes.Record[key] == jsonRecord[key])) {
            // we do not want this record as it does not match the filter criteria
            continue;
          }
          allResults.push(jsonRes);
        }
      }
      // ******************* End LevelDB filter handling ******************************************
      // For CouchDB, push all results
      // allResults.push(jsonRes);
    }
    if (res.done) {
      await iterator.close();
      console.log('##### queryByString all results: ' + JSON.stringify(allResults));
      console.log('============= END : queryByString ===========');
      return Buffer.from(JSON.stringify(allResults));
    }
  }
}
 
 
 /***************************************************************** 
 * CHAINCODE
 ******************************************************************/
 let Chaincode = class {
 /**
 
    * Initialize the state when the chaincode is either instantiated or upgraded
 
    * 
 
    * @param {*} stub 
 
**/
 
 async Init(stub) {
 
 console.log('=========== Init: Instantiated / Upgraded ngo chaincode ===========');
 
 return shim.success();
 
   }
  /**
 
   The Invoke method will call the methods below based on the method name passed by the calling
 
    * 
 
    * @param {*}stub 
 
  **/
   
 async Invoke(stub) {
 
 console.log('============= START : Invoke ===========');
 
 let ret = stub.getFunctionAndParameters();
 
  console.log('##### Invoke args: ' + JSON.stringify(ret));
 
 
 
 
 let method = this[ret.fcn];
 
 if (!method) {
 
       console.error('##### Invoke - error: no chaincode function with name: ' + ret.fcn + ' found');
 
 throw new Error('No chaincode function with name: ' + ret.fcn + ' found');
 
     }
 
 try {
 
 let response = await method(stub, ret.params);
 
 console.log('##### Invoke response payload: ' + response);
 
 return shim.success(response);
 
 } catch (err) {
 
 console.log('##### Invoke - error: ' + err);
 
 return shim.error(err);
 
     }
 
   }
 async initLedger(stub, args) {
 
 console.log('============= START : Initialize Ledger ===========');
 
 console.log('============= END : Initialize Ledger ===========');
 
   }
 
 /****************************************************************************************
 *
 * Student functions
 *
 ******************************************************************************************/
 /**
 
 
 * Creates a new student
 *
 * @param {*} stub 
 
 * @param {*} args - JSON as follows:
 
    * {
 
    *    “studentID”:”123”,
    *    “studentName":"edge",
 
    *    "email":"edge@abc.com",
 
    *    "registeredDate":"2018-10-22T11:52:20.182Z"
    *    “DOB”:”1986-11-20”
 
    * }
 
 **/
 async createStudent(stub, args) {
 
 console.log('============= START : createStudent ===========');
 
 console.log('##### createStudent arguments: ' + JSON.stringify(args));
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let key = 'student' + json ['studentName'];
 
 json['docType'] = 'student';
 console.log('##### createStudent payload: ' + JSON.stringify(json));
 
 
 
  // Check if the student already exists
 
     let studentQuery = await stub.getState(key);
 
     if (studentQuery.toString()) {
 
   throw new Error('##### createStudent - This student already exists: ' + json['studentName']);
 
     }
 
 await stub.putState(key, Buffer.from(JSON.stringify(json)));
 
 console.log('============= END : createStudent ===========');
 
 }
 
 /**
 * Retrieves a specfic student
 *
 * @param {*} stub 
 * @param {*} args
 */
 
 
 async queryStudent(stub, args) {
 
 console.log('============= START : queryStudent ===========');
 
 console.log('##### queryStudent arguments: ' + JSON.stringify(args));
 
 // args is passed as a JSON string
 
 
 let json = JSON.parse(args);
 let key = 'student' + json['studentName'];
 console.log('##### queryStudent key: ' + key);
 
  
 return queryByKey(stub, key);
 }
 
 /**
 *
 * Retrieves all students
 *
 * @param {*} stub
 * @param {*} args
 */
 
 async queryAllStudents(stub, args) {
 
 console.log('============= START : queryAllStudents ===========');
 
 console.log('##### queryAllStudents arguments: ' + JSON.stringify(args));
 
 let queryString = '{"selector": {"docType": “student”}}';
 return queryByString(stub, queryString);
 
 }
 
 /*********************************************************************************************
 *
 * HEI functions
 *
 ***********************************************************************************************/
 
 /**
 * Creates a new HEI
 *
 * @param {*} stub
 * @param {*} args - JSON as follows:
  * {
 
    *    “HEIRegistrationNumber":"6322",
 
    *    “HEIName”:”UTS”,
 
    *    “Country”:”Australia”,
 
    *    "address":"15 Broadway, Ultimo NSW 2007",
 
    *    "contactNumber":"82372837",
 
    *    "contactEmail":"grs@connect.uts.edu.au"
 
 * }
 
  **/
 
 
 
 async createHEI(stub, args) {
 
 console.log('============= START : createHEI ===========');
 
 console.log('##### createHEI arguments: ' + JSON.stringify(args));
 
 
 // args is passed as a JSON string
 
   let json = JSON.parse(args);
   let key = 'hei' + json['heiRegistrationNumber'];
   json['docType'] = 'hei';
 
  console.log('##### createHEI payload: ' + JSON.stringify(json));
 
 // Check if the HEI already exists
 
 let heiQuery = await stub.getState(key);
 
 if (heiQuery.toString()) {
 
       throw new Error('##### createHEI - This HEI already exists: ' + json['heiRegistrationNumber']);
 
 }
 
    await stub.putState(key, Buffer.from(JSON.stringify(json)));
    console.log('============= END : createHEI ===========');
    }
 
 /**
 * Retrieves a specfic HEI
 *
 * @param {*} stub
 * @param {*} args 
 */
 
 async queryHEI(stub, args) {
 
 console.log('============= START : queryHEI ===========');
 
 console.log('##### queryHEI arguments: ' + JSON.stringify(args));
 
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let key = 'hei' + json['heiRegistrationNumber'];
 
 console.log('##### queryHEI key: ' + key);
 
 
 
 
 return queryByKey(stub, key);
 
 }
 
 /** 
 * Retrieves all HEIs
 *
 * @param {*} stub
 * @param {*} args
  **/
 
 async queryAllHEIs(stub, args) {
 
 console.log('============= START : queryAllHEIs ===========');
 
 console.log('##### queryAllHEIs arguments: ' + JSON.stringify(args));
 
  
 
     let queryString = '{"selector": {"docType": “hei”}}';
 
     return queryByString(stub, queryString);
 
 }
 
 /************************************************************************************************
 *
 * Credentials functions
 *
 ************************************************************************************************/
 
 
 /**
 * Creates a new Credential
 *
 * @param {*} stub
 * @param {*} args - JSON as follows:
 * {
 
    *    “credentialId”:”2211",
 
    *    “credentialScore:100,
 
    *    “credentialDate":"2018-09-20T12:41:59.582Z",
 
    *    “studentName":"edge",
 
    *    “HEIRegistrationNumber":"6322"
 
    * }
 
 
  **/
 
 
 async createCredential(stub, args) {
 
 console.log('============= START : createCredential ===========');
 
 console.log('##### createCredential arguments: ' + JSON.stringify(args));
 
 
  // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let key = 'credential'+json['credentialId'];
 
 json['docType'] = 'credential';
 
   console.log('##### createCredential credential: ' + JSON.stringify(json));
 
  // Confirm the HEI exists
 
 let heiKey = 'hei' + json['heiRegistrationNumber'];
 
 let heiQuery = await stub.getState(heiKey);
 
 if (!heiQuery.toString()) {
 
 throw new Error('##### createCredential - Cannot create credential as the HEI does not exist: ' + json['heiRegistrationNumber']);
 
}
   // Confirm the student exists
 
 let studentKey = 'student' + json['studentName'];
 
 let studentQuery = await stub.getState(studentKey);
 
 if (!studentQuery.toString()) {
 
 throw new Error('##### createCredential - Cannot create credential as the student does not exist: ' + json['studentName']);
}
 
 
   // Check if the Credential already exists
 
 let credentialQuery = await stub.getState(key);
 
 if (credentialQuery.toString()) {
 
 throw new Error('##### createCredential - This Credential already exists: ' + json['credentialId']);
 
}
   await stub.putState(key, Buffer.from(JSON.stringify(json)));
   console.log('============= END : createCredential ===========');
  }
 
 
 
 /*
 * Retrieves a specfic credential 
 *
 * @param {*} stub
 * @param {*} args 
 */
 
 async queryCredential(stub, args) {
 
 console.log('============= START : queryCredential ===========');
 
 console.log('##### queryCredential arguments: ' + JSON.stringify(args));
 
  // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let key = 'credential' + json['credentialId'];
 
 console.log('##### queryCredential key: ' + key);
 
 return queryByKey(stub, key);
 
 }
 
 /*
 * Retrieves credentials for a specfic student
 *
 * @param {*} stub 
 * @param {*} args
 */
 
  async queryCredentialsForStudent(stub, args){
 
 console.log('=========== START : queryCredentialsForStudent ===========');
 
 console.log('##### queryCredentialsForStudent arguments: ' + JSON.stringify(args));
  
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let queryString = '{"selector": {"docType": “credential”, “studentName": "' + json['studentName'] + '"}}';
 
    return queryByString(stub, queryString);
 
  }
 
 
 /*
 * Retrieves credentials for a specfic HEI
 *
 * @param {*} stub
 * @param {*} args
 */
  async queryCredentialsForHEI(stub, args) {
 
 console.log('============= START : queryCredentialsForHEI ===========');
 
 console.log('##### queryCredentialsForHEI arguments: ' + JSON.stringify(args));
  
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let queryString = '{"selector": {"docType": “credential”, “heiRegistrationNumber": "' + json['heiRegistrationNumber'] + '"}}';
 
    return queryByString(stub, queryString);
 
  }
 
 /*
 * Retrieves all credentials
 *
 * @param {*} stub 
 * @param {*} args
 */
 
 
 async queryAllCredentials(stub, args) {
 
 console.log('============= START : queryAllCredentials ===========');
 
 console.log('##### queryAllCredentials arguments: ' + JSON.stringify(args)); 
 
 let queryString = '{"selector": {"docType": “credential”}}';
 
 return queryByString(stub, queryString);
 
 }
 
 /************************************************************************************************
 *
 * pseudonym functions
 *
 ************************************************************************************************/
 
 /*
 *
 * Creates a new pseudonym
 *
 * @param {*} stub
 * @param {*} args - JSON as follows:
    * {
 
    *    “studentName”:”edg”,
 
    *    "studentId”:”123”,
 
    *    "pseudonym”:”001011”,
 
   
 
 
 
 * }
 
 */
  async createPseudonym(stub, args) {
 
 
 
 console.log('============= START : createPseudonym ===========');
 
 console.log('##### createPseudonym arguments: ' + JSON.stringify(args));
 
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let key = 'pseudonym' + json['studentName'];
 
 json['docType'] = 'pseudonym';
 
  console.log('##### createPseudonym pseudonym: ' + JSON.stringify(json)); 
 
 
 //Confirm the StudentName exists
 
 let studentKey = 'student' + json['studentName'];
 
 let studentQuery = await stub.getState(studentKey);
 
 if (!studentQuery.toString()) {
 
 throw new Error('##### createPseudonym - Cannot create pseudonym record as the StudentName does not exist: ' + json['studentName']);
 
    }
  // Check if the Pseudonym already exists
 
 let pseudonymQuery = await stub.getState(key);
 
 if (pseudonymQuery.toString()) {
 
 throw new Error('##### createPseudonym - This Pseudonym:' + json['pseudonym']+ 'for this Student: ' + json['studentName'] + 'already exists: ');
 
    }
 await stub.putState(key, Buffer.from(JSON.stringify(json)));
 console.log('============ END : createPseudonym ===========');
 
 }
 /*
 *
 * Retrieves Pseudonym for a specfic student
 *
 * @param {*} stub
 * @param {*} args
 */
 async queryPseudonymForStudent(stub, args) {
 
 console.log('============= START : queryPseudonymForStudent ===========');
 
 console.log('##### queryPseudonymForStudent arguments: ' + JSON.stringify(args));
 
 // args is passed as a JSON string
 
 let json = JSON.parse(args);
 
 let queryString = '{"selector": {"docType": “Pseudonym”, “studentName”: "' + json['studentName'] + '"}}';
 
 return queryByString(stub, queryString);
 
   }
 
 /************************************************************************************************
 *
 * Blockchain related functions 
 *
 ************************************************************************************************/
 
 
 /**
 * Retrieves the Fabric block and transaction details for a key or an array of keys
 *
 * @param {*} stub
 * @param {*} args - JSON as follows:
 * [
 *    {"key": "a207aa1e124cc7cb350e9261018a9bd05fb4e0f7dcac5839bdcd0266af7e531d-1"}
 *  ]
 *
 */
 
 async queryHistoryForKey(stub, args) {
 
 console.log('============= START : queryHistoryForKey ===========');
 
 console.log('##### queryHistoryForKey arguments: ' + JSON.stringify(args));
 
 
 // args is passed as a JSON string
 
     let json = JSON.parse(args);
 
     let key = json['key'];
 
     let docType = json['docType']
 
     console.log('##### queryHistoryForKey key: ' + key);
 
     let historyIterator = await stub.getHistoryForKey(docType + key);
 
     console.log('##### queryHistoryForKey historyIterator: ' + util.inspect(historyIterator));
 
     let history = [];
 
     while (true) {
 
       let historyRecord = await historyIterator.next();
 
       console.log('##### queryHistoryForKey historyRecord: ' + util.inspect(historyRecord));
 
       if (historyRecord.value && historyRecord.value.value.toString()) {
 
         let jsonRes = {};
 
         console.log('##### queryHistoryForKey historyRecord.value.value: ' + historyRecord.value.value.toString('utf8'));
 
         jsonRes.TxId = historyRecord.value.tx_id;
 
         jsonRes.Timestamp = historyRecord.value.timestamp;
 
         jsonRes.IsDelete = historyRecord.value.is_delete.toString();
 
       try {
 
           jsonRes.Record = JSON.parse(historyRecord.value.value.toString('utf8'));
 
         } catch (err) {
 
           console.log('##### queryHistoryForKey error: ' + err);
 
           jsonRes.Record = historyRecord.value.value.toString('utf8');
 
         }
 
         console.log('##### queryHistoryForKey json: ' + util.inspect(jsonRes));
 
         history.push(jsonRes);
 
       }
 
       if (historyRecord.done) {
 
         await historyIterator.close();
 
         console.log('##### queryHistoryForKey all results: ' + JSON.stringify(history));
 
         console.log('============= END : queryHistoryForKey ===========');
 
         return Buffer.from(JSON.stringify(history));
 
       }
 
     }
 
   }
 
 }
 
 
 shim.start(new Chaincode());
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
  
 
 
 
 
 
 
 
 
 
 