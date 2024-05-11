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
    const nodemailer = require("nodemailer");
    const jwt = require('jsonwebtoken');

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
            from: '"UGC Stocks" <support@ugcstocks.com>',
            to: email,
            subject: "UGC Stocks Notification",
            // text: "Hello world?",
            html: msg,
        });
        return info.messageId;
    }
      
    app.use(bodyParser.json());
    app.use(cors())
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
    });
    
    const upload = multer();

    app.post('/getsinglevideo', async (req, res) => {
        const { contentid } = req.body;
        try{
            const content = `SELECT * FROM Content WHERE ContentID = ${contentid}`;
            const [contentrow, contentfields] = await connection.promise().query(content);
            res.json({ msg: contentrow[0]});
        } catch(error){
            res.json({error});
        }
    });


    app.post('/savefav', async (req, res) => {
        const { contentid , userid } = req.body;
        try{
            const content = `SELECT * FROM Content WHERE ContentID = ${contentid}`;
            const [contentrow, contentfields] = await connection.promise().query(content);
            // Insert User Fav
            const adduserfav = `INSERT INTO UserContent (UserID, ContentID, videourl, imageurl) VALUES ('${userid}','${contentid}','${contentrow[0].FilePath}','${contentrow[0].imagepath}')`;
            const [adduserfavrow, adduserfavfields] = await connection.promise().query(adduserfav);
            res.json({ msg: 'Saved Successfully'});
        } catch(error){
            res.json({ error });
        }
    });

    app.get('/video/:userid/:pagin/', async (req, res) => {
        const { userid , pagin } = req.params;
        var pagination = pagin * 12;
        try{
            // All Videos
            const Videos = `SELECT * FROM Content LIMIT ${pagination}`;
            const [videorow, videofields] = await connection.promise().query(Videos);
            // All Favourite
            const favourite = `SELECT * FROM UserContent WHERE UserID = ${userid}`;
            const [favouriterow, favouritefields] = await connection.promise().query(favourite);
            // Get Video Tag
            var tag = []
            videorow.map((value,key) => {
                JSON.parse(value.Description).map((values,keys) => {
                    if(!tag.includes(values.toLowerCase().trim())){
                        tag.push(values.toLowerCase().trim())
                    }
                })
            })
            // get invoice url
            const invoice = `SELECT transactionobject FROM Transaction WHERE UserID = ${userid}`;
            const [invoicerow, invoicefields] = await connection.promise().query(invoice);    
            var getdetail = JSON.parse(invoicerow[0].transactionobject);
            getdetail = getdetail.length == undefined ? getdetail : getdetail[getdetail.length-1];
            const invoiceresult = await stripe.invoices.retrieve(getdetail.invoice);
            // display json
            res.json({
                video:videorow,
                favourite:favouriterow,
                videotag:tag,
                invoiceurl:invoiceresult.hosted_invoice_url,
            });
        } catch (err) {
            res.json({error:err});
        }
    });

    app.get('/filtertag', async (req, res) => {
        var keyword = req.query[0].toLowerCase();
        try{
            const filter = `SELECT * FROM Content`;
            const [filterrow, filterfields] = await connection.promise().query(filter);
            var filterresult = [];
            filterrow.map((value,key) => {
                const tagresult = JSON.parse(value.Description).map(word => word.toLowerCase());
                if(tagresult.includes(keyword)){
                    filterresult.push(value)
                }
            })
            res.json({data:filterresult});
        } catch(error){
            res.json({error});
        }
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


    app.get('/login', (req, res) => {
        let jwtSecretKey = process.env.JWT_SECRET_KEY;
        // let data = { time: Date(), userId: 12 }
        // const token = jwt.sign(data, jwtSecretKey);
        const verified = jwt.verify(token, jwtSecretKey);
        console.log(token)
    });

    app.post('/verifylogin', async (req, res) => {
        var { token } = req.body;
        const verified = jwt.verify(token, process.env.JWT_SECRET_KEY);
        res.json({ msg: verified });
    });
    app.post('/login', async (req, res) => {
        var { email , password } = req.body;
        var password = md5(password);
        try{
            const userdetail = `SELECT * FROM Users LEFT JOIN Transaction ON Users.UserID=Transaction.UserID WHERE Users.Email = '${email}' `;
            const [userdetailrow, userdetailfields] = await connection.promise().query(userdetail);
            if(userdetailrow.length > 0){
                if(password == userdetailrow[0].Password){
                    var loginuser = userdetailrow[0];
                    delete loginuser.transactionobject;
                    delete loginuser.Password;
                    loginuser.time = Date();
                    const token = jwt.sign(loginuser, process.env.JWT_SECRET_KEY);
                    res.json({ msg: token });
                }else{
                    res.json({ error: 'Password is Wrong' });
                }
            }else{
                res.json({ error: 'Email is Wrong' });
            }
        } catch(error){
            res.json({ error });
        }
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
        const sql_getvideo = 'SELECT * FROM Users RIGHT JOIN Transaction ON Users.UserID=Transaction.UserID';
        connection.query(sql_getvideo, (err, results, fields) => {
            res.json({ data: results });
        });
    });


    app.post('/googleregister', (req, res) => {
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
        res.send('hello world')
    });


    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });