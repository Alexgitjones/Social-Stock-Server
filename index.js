    require('dotenv').config()
    const express = require('express');
    const bodyParser = require('body-parser');
    const app = express();
    const multer = require('multer');
    const path = require('path');
    var cors = require('cors')
    var md5 = require('md5');
    const mysql = require('mysql2');
    const port = process.env.PORT || 5000;
    const stripe = require('stripe')(process.env.STRIPE_SK_TEST);
    const cloudinary = require('cloudinary').v2;
    const axios = require('axios');
    const fs = require('fs');
    const ffmpeg = require('fluent-ffmpeg');
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
        host: process.env.UGCWEBMAILHOST,
        port: 587,
        auth: {
            user: process.env.UGCEMAILUSER,
            pass: process.env.UGCEMAILPASS
        }
    });  
    
    async function sendmail(msg,email){
        const info = await transporter.sendMail({
            from: '"UGC Stocks" <support@ugcstocks.com>', // sender address
            to: email, // list of receivers
            subject: "UGC Stocks Notification", // Subject line
            // text: "Hello world?", // plain text body
            html: msg, // html body
        });
        return info.messageId;
    }
      
    app.use(bodyParser.json());
    app.use(cors())
    // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    // app.use('/videoslink', express.static(path.join(__dirname, 'videos')));

    // const api = require('./api');
    // app.use('/api/v1', api);
    // cloudinary
    cloudinary.config({
        cloud_name: 'du73if3k3',
        api_key: '154557696214544',
        api_secret: 'DGmCS3ivElkGL1US4yeRxfZUejo'
    });


    // MySQL database connection
    const connection = mysql.createConnection({
        host: 'demowebs.1stopwebsitesolution.com',
        user: 'demowebs_socialuser',
        password: 'SE1{X%!~dmB-',
        database: 'demowebs_socialstock',
    });
    // Connect to MySQL
    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            return;
        }
        console.log('Connected to MySQL');
        // console.log(process.env.URL);
    });
    
    const upload = multer();


    app.post('/getsinglevideo', (req, res) => {
        const { contentid } = req.body;
        const sql_getuser = 'SELECT * FROM `Content` WHERE `ContentID` = ? ';
        const sql_getuser_values = [contentid];
        connection.query(sql_getuser, sql_getuser_values, (err, results, fields) => {
            if (err) {
                res.json({ error: err});
                return;
            }
            res.json({ msg: results[0]});
            // connection.end();
        })
    });


    app.post('/savefav', (req, res) => {
        const { contentid , userid } = req.body;
        const sql_getuser = 'SELECT * FROM `Content` WHERE `ContentID` = ? ';
        const sql_getuser_values = [contentid];
        connection.query(sql_getuser, sql_getuser_values, (err, results, fields) => {
            if (err) {
                res.json({ error: err});
                return;
            }
            const sql_registereduser = 'INSERT INTO `UserContent`(`UserID`, `ContentID`, `videourl`, `imageurl`) VALUES (?, ?, ?, ?)';
            const sql_registereduser_values = [userid, contentid, results[0].FilePath, results[0].imagepath];
            connection.query(sql_registereduser, sql_registereduser_values, (err, result) => {
                if (err) {
                    res.json({ error: err});
                    return;
                }
                res.json({ msg: 'Saved Successfully',data:result});
                // connection.end();
            });
        });  
    });


    app.post('/upload', upload.single('file'), async (req, res) => {
        try {
        const { userID, fileType, title, description } = req.body;
        const result = await cloudinary.uploader.upload_stream({ resource_type: fileType }, (error, result) => {
            if (error) {
                res.json({ error: error}); 
            } else {
            const maketags = JSON.stringify(description.split(','));
            const filePath = result.secure_url;
            const options = {
                method: 'POST',
                url: 'https://api.apyhub.com/generate/image-thumbnail/url',
                params: { output: 'test-sample.png' },
                headers: {
                'apy-token': 'APY0qeFV3QEE6CbPyv3n4OrxH2KzJXcBtIk6SWgHnGuumSXrrkKMgKQY2BQlJr5Crd6VjrBln',
                'Content-Type': 'application/json'
                },
                data: {
                video_url: filePath,
                time: '1',
                size: '400x300'
                }
            };
            axios.request(options)
            .then(async function (response) {
                    const uploadResult = await cloudinary.uploader.upload(response.data.data, {
                        folder: 'thumbnails', // Optional: Specify a folder in Cloudinary to save the image
                        resource_type: 'image' // Optional: Specify the resource type (image, raw, video, etc.)
                    });
                    const currentdate = new Date().getDate()+'-'+(new Date().getMonth()+1)+'-'+new Date().getFullYear();
                    const sql = 'INSERT INTO `Content` (`UserID`, `Title`, `Description`, `FilePath`, `imagepath` , `UploadDate`, `Type`) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    const values = [userID, title, maketags, filePath, uploadResult.secure_url ,currentdate, fileType];
                    connection.query(sql, values, (err, results, fields) => {
                        if (err) {
                        res.json({ error: err});
                        return;
                        }
                        res.json({ msg: 'File Upload Successfully'});
                        connection.end();
                    });
            })
            .catch(function (error) {
                console.error(error);
            });
            }
        }).end(req.file.buffer);
        // const cloud_video_url = await cloudinary.uploader.upload(req.file.path, { resource_type: fileType });
        } catch (error) {
            res.json({ error: error}); 
        }
    });


    app.get('/video/:userid/:pagin/', (req, res) => {
        const { userid , pagin } = req.params;
        var pagination = pagin * 12;
        const sql_getvideo = 'SELECT * FROM Content LIMIT '+pagination;
        connection.query(sql_getvideo, (err, results, fields) => {
            if(err){
                res.json({error:err});    
            }else{
                var getcustomtag = [];
                results.map((value,key) => {
                    // if(getcustomtag.length <= 20){
                    if(JSON.parse(value.Description).length == 1){
                        if(!getcustomtag.includes(JSON.parse(value.Description)[0].toLowerCase().trim())){
                            getcustomtag = getcustomtag.concat([JSON.parse(value.Description)[0].toLowerCase().trim()])
                        }
                    }else if(JSON.parse(value.Description).length > 1){
                        JSON.parse(value.Description).map((val,num) => {
                            // console.log(getcustomtag)
                            if(!getcustomtag.includes(val.toLowerCase().trim())){
                                getcustomtag = getcustomtag.concat([val.toLowerCase().trim()])
                            }
                        })
                    }
                    // }
                })
                const sql_user_fav = 'SELECT * FROM `UserContent` WHERE `UserID` = ? ';
                const sql_user_fav_values = [userid];
                connection.query(sql_user_fav, sql_user_fav_values, (err, favs, fields) => {
                    res.json({video:results,videotag:getcustomtag,favourite:favs});
                });
            }
            // connection.end();
        });
    });

    app.get('/filtertag', (req, res) => {
        // const { pagin } = req.params;
        // var pagination = pagin * 12;
        const sql_getvideo = 'SELECT * FROM Content';
        connection.query(sql_getvideo, (err, results, fields) => {
            var get_filter_data = [];
            if(Object.values(req.query).length > 0 ){
            Object.values(req.query).map((values,keys) => {
                results.map((value,key) => {
                    const Description = JSON.parse(value.Description).map(word => word.toLowerCase());
                    if(Description.includes(values.toLowerCase())){
                        const check = get_filter_data.filter((val,ky) => { return val.ContentID == value.ContentID } )
                        if(!check.length){
                            get_filter_data.push(value)
                        }
                    }
                })
            })
            }else{
                get_filter_data = results
            }
            res.json({data:get_filter_data});
            // connection.end();
        });
    });


    app.post('/register', async (req, res) => {
        // Getting value
        var { firstName, lastName, email , password, priceid } = req.body;
        var username = firstName+' '+lastName;
        var password = md5(password);
        // create checkout session
        const session = await stripe.checkout.sessions.create({
            line_items: [
            {
                price: priceid,
                quantity: 1,
            },
            ],
            mode: 'subscription',
            success_url: `${process.env.URL}/thank-you/?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.URL}/thank-you/?canceled=true`,
        });
        
        // Check user
        const sql_getuser = 'SELECT * FROM Users WHERE `Email` = ? ';
        const sql_getuser_values = [email];
        connection.query(sql_getuser, sql_getuser_values, (err, results, fields) => {
            if (err) {
                res.json({ error: err});
                return;
            }
            if(results.length !== 0){
                res.json({ error: 'User Already Registered'});
                return;
            }
            // Register User
            const sql_registereduser = 'INSERT INTO `Users`(`fname`, `lname`, `Username`, `Email`, `Password`, `UserType`) VALUES (?, ?, ?, ?, ?, "normal")';
            const sql_registereduser_values = [firstName, lastName, username, email, password];
            connection.query(sql_registereduser, sql_registereduser_values, (err, result) => {
                if (err) {
                    res.json({ error: err});
                    return;
                }
                res.json({msg:{UserID:result.insertId,Email:email,status:null,url:session.url}});
            });   
            // connection.end();
        });
    });


    app.post('/maketransaction', async (req, res) => {
        // Getting value
        var { price } = req.body;
        const session = await stripe.checkout.sessions.create({
            line_items: [
            {
                price: price,
                quantity: 1,
            },
            ],
            mode: 'subscription',
            success_url: `${process.env.URL}/thank-you/?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.URL}/thank-you/?canceled=true`,
        });
        // console.log(session)
        res.json({url:session.url})
    });


    app.post('/transaction', async (req, res) => {
        // Getting value
        var { id , session_id } = req.body;
        const session = await stripe.checkout.sessions.retrieve(
            session_id
        );
        const get_user = 'SELECT Email FROM Users WHERE UserID = ?';
        connection.query(get_user, [id], (err, result) => {
            var Email_msg = '<strong>You have Purchased our Subscription Successfully<br>Thank you for being a valued member of our Community.<strong>'
            const getsendmsg = sendmail(Email_msg,result[0].Email)
            getsendmsg.then((msg) => {
                // console.log(msg)
            })
        });
       
        const getprev_user = 'SELECT transactionobject FROM Transaction WHERE UserID = ?';
        connection.query(getprev_user, [id], (err, result) => {
            if(result.length > 0){
                var makevalue = JSON.parse(result[0].transactionobject);
                makevalue = makevalue.length == undefined ? [makevalue] : makevalue
                makevalue.push(session)
                const sqlupdate = 'UPDATE `Transaction` SET `transactionobject` = ? , `PaymentStatus` = ? WHERE `UserID` = ?';
                connection.query(sqlupdate, [JSON.stringify(makevalue),'complete',id], async (updateerror, updateresult) => {
                    if (updateerror) {
                        res.json({ error: err});
                        return;
                    }
                    res.json({ msg: 'Success'});
                });
            }else{
                const sql_registereduser = 'INSERT INTO `Transaction`(`UserID`, `Amount`, `TransactionDate`, `PaymentStatus` , `transactionobject`) VALUES (?, ?, ?, ?, ?)';
                const sql_registereduser_values = [id, session.amount_total , session.created, session.status, JSON.stringify(session)];
                connection.query(sql_registereduser, sql_registereduser_values, (err, result) => {
                    if (err) {
                        res.json({ error: err});
                        return;
                    }
                    res.json({ msg: 'Success'});
                    // connection.end();
                });
            }
        });
        
        
        
    });

    app.post('/cancel', async (req, res) => {
        var {id} = req.body;
        const sql_getTransactions = 'SELECT transactionobject FROM Transaction WHERE UserID = ?';
        connection.query(sql_getTransactions, [id], async (transactionError, transactionResults) => {  
            var getdetail = JSON.parse(transactionResults[0].transactionobject);
            getdetail = getdetail.length == undefined ? getdetail : getdetail[getdetail.length-1];
            const subscription = await stripe.subscriptions.cancel(getdetail.subscription); 
            const sqlupdate = 'UPDATE `Transaction` SET `PaymentStatus` = ? WHERE `UserID` = ?';
            connection.query(sqlupdate, [subscription.status,id], async (updateerror, updateresult) => {
                res.json({data:subscription.status})
            });
        });
    });

    app.get('/transaction', async (req, res) => {
        // Getting value
        // var { id , session_id } = req.body;
        try{
            const getprev_user = 'SELECT transactionobject FROM Transaction WHERE UserID = ?';
            connection.query(getprev_user, [52], (err, result) => {
                var maekvalue = JSON.parse(result[0].transactionobject);
                // maekvalue = maekvalue.length == undefined ? [maekvalue] : maekvalue 
                // var appendvalue = [JSON.parse(result[0].transactionobject)]
                // appendvalue.push(JSON.parse(result[0].transactionobject))
                // var newappend = appendvalue ;
                // newappend.push(JSON.parse(result[0].transactionobject)) 
                res.json({data:maekvalue});
                // if(result.length > 0){
                //     // var makeappend = [result[0].transactionobject]
                //     // makeappend.push()
                // }
            });
            // const session = await stripe.checkout.sessions.retrieve(
            //     'cs_test_a16kdna01lOccVn68JnjrhfdIBiqXrXvrSU40ghBeT5cNmgzA8SqWYEEtE'
            // );
            // //   const customtersession = await stripe.billingPortal.sessions.create({
            // //     customer: session.customer,
            // //     return_url: 'https://example.com/account',
            // // });
            // const subscription = await stripe.subscriptions.retrieve(
            //     session.subscription
            // );
            // const subscription = await stripe.subscriptions.cancel(session.subscription);
            // res.json(subscription);
        }catch(error){
            console.log(error)
        }
     
        // const customtersession = await stripe.billingPortal.sessions.create({
        //     customer: session.customer,
        //     return_url: 'https://example.com/account',
        // });
        // const subscription = await stripe.subscriptions.retrieve(
        //     session.subscription
        // );
        // res.json(session);

        
    });

    app.post('/login', (req, res) => {
        var { email , password } = req.body;
        var password = md5(password);
        const sql_getuser = 'SELECT * FROM Users WHERE Users.Email = ?';
        const sql_getuser_values = [email];
        connection.query(sql_getuser, sql_getuser_values, (err, results, fields) => {
            if (err) {
                res.json({ error: err});
                return;
            }else{
                if(results.length > 0){
                    if(results[0].Password == password){
                        const result_userid = results[0].UserID;
                        const sql_getTransactions = 'SELECT PaymentStatus FROM Transaction WHERE UserID = ?';
                        var getallresult = [];
                        connection.query(sql_getTransactions, [result_userid], (transactionError, transactionResults) => {
                            if(transactionError){
                                res.json({ error: transactionError });        
                            }else if(transactionResults.length > 0 ){
                                results[0].status = transactionResults[0].PaymentStatus == 'canceled' ? 'failed' : transactionResults[0].PaymentStatus  
                                res.json({ msg: results[0] });
                            }else{
                                results[0].status = null
                                res.json({ msg: results[0] });
                            }    
                        });
                    }else{
                        res.json({ error: 'Password is Wrong' });
                    }
                }else{
                    res.json({ error: 'Email is Wrong' });
                }
            }
            // connection.end();
        });
    });

    app.get('/invoice/:id', async (req, res) => {
        const sql_getTransactions = 'SELECT transactionobject FROM Transaction WHERE UserID = ?';
        connection.query(sql_getTransactions, [req.params.id], async (transactionError, transactionResults) => {    
            var getdetail = JSON.parse(transactionResults[0].transactionobject);
            getdetail = getdetail.length == undefined ? getdetail : getdetail[getdetail.length-1];
            const invoice = await stripe.invoices.retrieve(getdetail.invoice);
            res.json({data:invoice.hosted_invoice_url})
                // res.json({data:'hello'})
                // connection.end();
        });
    });

    function createRandomString(length) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }


    function generate_video_img(video_path) {
        return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            url: 'https://api.apyhub.com/generate/image-thumbnail/url',
            params: { output: 'test-sample.png' },
            headers: {
            'apy-token': 'APY0qeFV3QEE6CbPyv3n4OrxH2KzJXcBtIk6SWgHnGuumSXrrkKMgKQY2BQlJr5Crd6VjrBln',
            'Content-Type': 'application/json'
            },
            data: {
            video_url: video_path,
            time: '1',
            size: '400x300'
            }
        };
        axios.request(options)
        .then(async function (response) {
                const uploadResult = await cloudinary.uploader.upload(response.data.data, {
                    folder: 'thumbnails', // Optional: Specify a folder in Cloudinary to save the image
                    resource_type: 'image' // Optional: Specify the resource type (image, raw, video, etc.)
                });
                resolve(uploadResult.secure_url)
        })
        .catch(function (error) {
            reject(error)
        });
        });
    }
    
    app.get('/urlvideo', async (req, res) => {
        var timestamp = createRandomString(12);
        generate_video_img('https://server.ugcstocks.com/videos/660c7c0d023d3-link-high.mp4')
        .then(thumbnailUrl => {
            res.json({url:thumbnailUrl})
        })
    });

    app.post('/urlvideo', async (req, res) => {
        // const videoUrl = req.body.videosurl;
        try {
            const { userID, title ,description } = req.body;
            // console.log(description)
            const maketags = JSON.stringify(description.split(','));
            var timestamp = createRandomString(12);
            const videoUrl = title;
            const response = await axios.get(videoUrl, { responseType: 'stream' });
            const fileName = timestamp+'-link-'+path.basename(videoUrl);
            const offurl = 'http://89.116.191.15:5000/videoslink/'+fileName;
            const filePath = path.join(__dirname, 'videos', fileName);
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);
            const currentdate = new Date().getDate()+'-'+(new Date().getMonth()+1)+'-'+new Date().getFullYear();
            
            const sql = 'INSERT INTO `Content` (`UserID`, `Title`, `Description`, `FilePath`, `imagepath` , `UploadDate`, `Type`) VALUES (?, ?, ?, ?, ?, ?, ?)';
            generate_video_img(offurl)
            .then(thumbnailUrl => {
                const values = [userID, 'asdsa', maketags, fileName, thumbnailUrl ,currentdate, 'video'];
                connection.query(sql, values, (err, results, fields) => {
                    if (err) {
                    res.json({ error: err});
                    return;
                    }
                    res.json({ msg: 'File Upload Successfully'});
                });
            })
        
            } catch (error) {
                console.log(error)
                res.json({ error: error}); 
            }
    });


    app.post('/phpimg', async (req, res) => {
        generate_video_img(req.body.title)
        .then(thumbnailUrl => {
            const sql = 'UPDATE `Content` SET `imagepath` = ? WHERE `ContentID` = ?';
            const values = [thumbnailUrl, req.body.id]; // Assuming you have contentId and newImagePath defined somewhere
            connection.query(sql, values, (err, results, fields) => {
                if (err) {
                    res.json({ error: err });
                    return;
                }
                res.json({ msg: 'Video has been Uploaded' });
            });
            // res.json({ msg: thumbnailUrl});
        })
    });


    app.get('/userview', (req, res) => {
        // const { pagin } = req.params;
        // var pagination = pagin * 12;
        const sql_getvideo = 'SELECT * FROM Users RIGHT JOIN Transaction ON Users.UserID=Transaction.UserID';
        connection.query(sql_getvideo, (err, results, fields) => {
            res.json({ data: results });
        });
    });


    app.post('/googleregister', (req, res) => {
        // console.log(req.body)
        // res.json(req.body);
        const sql_getuser = 'SELECT * FROM Users WHERE `Email` = ? ';
        const sql_getuser_values = [req.body.email];
        connection.query(sql_getuser, sql_getuser_values, (err, results, fields) => {
            if (err) {
                res.json({ error: err});
                return;
            }
            if(results.length !== 0){
                const sql_getTransactions = 'SELECT PaymentStatus FROM Transaction WHERE UserID = ?';
                connection.query(sql_getTransactions, [results[0].UserID], (transactionError, transactionResults) => {
                    if(transactionError){
                        res.json({ error: transactionError });        
                    }else if(transactionResults.length > 0 ){ 
                        res.json({ msg: transactionResults[0].PaymentStatus, id:results[0].UserID });
                    }else{
                        res.json({ msg: 'failed', id:results[0].UserID });
                    }
                });
                return;
            }else{
                const sql_registereduser = 'INSERT INTO `Users`(`fname`, `lname`, `Username`, `Email`, `Password`, `UserType`) VALUES (?, ?, ?, ?, ?, "google")';
                const sql_registereduser_values = [req.body.given_name, req.body.family_name, req.body.name, req.body.email, req.body.id];
                connection.query(sql_registereduser, sql_registereduser_values, (err, result) => {
                    if (err) {
                        res.json({ error: err});
                        return;
                    }
                    res.json({ msg:'failed', id:result.insertId });
                });   
            }
        });
    });

    app.post('/googlelogin', (req, res) => {
        var { id } = req.body;
        const sql_getTransactions = 'SELECT PaymentStatus FROM Transaction WHERE UserID = ?';
        connection.query(sql_getTransactions, [id], (transactionError, transactionResults) => {
            if(transactionError){
                res.json({ error: transactionError });        
            }else if(transactionResults.length > 0 ){ 
                res.json({ msg: transactionResults[0].PaymentStatus });
            }else{
                res.json({ msg: 'failed' });
            }    
        });
    });


    app.get('/', async (req, res) => {
        // const get_user = 'SELECT Email FROM Users WHERE UserID = ?';
        // connection.query(get_user, [52], (err, result) => {
        //     var Email_msg = '<strong>You have been Purchased our Subscription Successfully<br>Thank you for being a valued member of our Community.<strong>'
        //     const getsendmsg = sendmail(Email_msg,result[0].Email)
        //     getsendmsg.then((msg) => {
        //         console.log(msg)
        //     })
        // });
        res.send('hello world')
    });


    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });