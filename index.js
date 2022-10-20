const express = require('express');
const handlebars = require('express-handlebars');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const router = express.Router();

const app = express();
const port = 3000;
const localHost = "localhost";

app.set('view engine', 'hbs');
app.engine('hbs', handlebars({
    layoutsDir: __dirname + '/views/layouts',
    extname: 'hbs',
    defaultLayout: 'index',
    partialsDir: __dirname + '/views/partials/'
}));
app.use(express.static('public'));

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "project"
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});


app.use(cookieParser());

const urlencodedParser = bodyParser.urlencoded({ extended: false })

app.use(session({
    key: 'user_sid',
    secret: 'password',
    resave: true,
    saveUninitialized: true,
    cookie: {
        expires: 600000
    }
}));

app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
    next();
});

let sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/home');
    } else {
        next();
    }
};

let notLogged = (req, res, next) => {
    if (!req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
};

app.get('/register', sessionChecker, function (req, res) {
    res.render('main', {title: "Database", user: req.session.user, register: true})});

app.get('/registerAddress', notLogged, function (req, res) {
    res.render('main', {title: "Database", user: req.session.user, registerAddress: true})});

app.get('/', sessionChecker, function (req, res) {
    res.render('main', {title: "Database", user: req.session.user, login: true})});

app.get('/home', notLogged, function (req, res) {
    con.query("SELECT nickname FROM person WHERE nickname != ?", [req.session.user.nickname],
        function (error, results, fields){
        let query = "SELECT city FROM location";
        con.query(query, function (error2, results2, fields2) {
            con.query("SELECT name, contact FROM contact NATURAL JOIN contact_type WHERE id_person = ?", [req.session.user.id_person],
                function (error3, results3, fields3) {
                con.query("SELECT nickname, description, name FROM relation NATURAL JOIN relation_type JOIN person ON relation.id_person2 = person.id_person WHERE relation.id_person1 = ?", [req.session.user.id_person],
                    function (error4, results4, fields4) {
                    con.query("SELECT start, description, duration FROM meeting NATURAL JOIN person_meeting WHERE id_person = ? GROUP BY start, description, duration", [req.session.user.id_person],
                        function (error5, results5, fields5) {
                        res.render('main', {
                            title: "Database",
                            meetings: results5,
                            relations: results4,
                            contacts: results3,
                            meetingLoc: results2,
                            userList: results,
                            user: req.session.user,
                            home: true
                        });
                    });
                });
            });
        });
    });
});

app.get('/logout', notLogged, function (req, res) {
    req.session.user = null;
    res.render('main', {title: "Database", user: req.session.user, logout: true})
});

app.get('/meeting', notLogged, function (req, res) {
    con.query("SELECT id_meeting, start, duration, description, id_location FROM person_meeting NATURAL JOIN meeting WHERE id_meeting NOT IN (SELECT id_meeting from person_meeting WHERE id_person = ? GROUP BY id_meeting) GROUP BY id_meeting, start, duration, description, id_location", [req.session.user.id_person],
        function (error, results, fields) {
        res.render('main', {
            title: "Database",
            meetings: results,
            user: req.session.user,
            meeting: true
        });
    });
});

app.post('/reg', urlencodedParser, function (req, res) {
    res.redirect("/register");
});

app.post('/regAddress', urlencodedParser, function (req, res) {
    res.redirect("/registerAddress");
});

app.post('/home', urlencodedParser, function (req, res) {
    res.redirect("/home");
});

app.post('/login', urlencodedParser, function (req, res) {
    res.redirect("/");
});

app.post('/logout', urlencodedParser, function (req, res) {
    res.redirect("/logout");
});

app.post('/meetings', urlencodedParser, function (req, res) {
    res.redirect("/meeting");
});

app.post('/', urlencodedParser, function (req, res){
    let values = req.body;
    ssn = req.session;
    con.query('SELECT id_person, nickname, first_name, last_name from login natural join person where nickname=? and password=md5(?)', [values.nickname, values.password],
        function(error, results,fields){
            if (error) throw error;
            if (results.length > 0){
                console.log("result: ");
                console.log(results);
                let user = {
                    id_person: results[0].id_person,
                    nickname: values.nickname,
                    first_name: results[0].first_name,
                    last_name: results[0].last_name
                }
                ssn.user = user;
                res.redirect('/home');
            }
            else {
                console.log("incorrect username or password");
            }
    });
});

app.post('/register', urlencodedParser, function (req, res) {
    let querySelect = "SELECT MAX(id_person) as maxID FROM person";
    let userid = null;
    con.query(querySelect, function (error, results, fields){
        if (error) throw error;
        userid = checkForID(userid, results);
        let val = req.body;
        let values = [userid, val['nickname'], val['firstname'], val['lastname'], 0, val['birthday'], val['height'], val['gender']];
        let query = mysql.createQuery("INSERT INTO person (id_person, nickname, first_name, last_name, id_location, birth_day, height, gender) VALUES (?)", [values]);
        console.log('save, ' + query.sql);
        console.log(values);
        con.query(query, function (err) {
            if (err) throw err;
            console.log("1 record inserted");
        });
        query = mysql.createQuery("INSERT INTO login (id_person, nickname, password) VALUES (?,?,md5(?))", [userid, val.nickname, val.password]);
        con.query(query, function (err) {
            if (err) throw err;
            console.log("1 record inserted");
        });
    });
    res.redirect("/");
});

app.post('/registerAddress', urlencodedParser, function (req, res) {
    let querySelect = "SELECT MAX(id_location) as maxID FROM location";
    let locationID = null;
    con.query(querySelect, function (error, results, fields) {
        if (error) throw error;
        locationID = checkForID(locationID, results);
        let val = req.body;
        let values = [locationID, val['city'], val['streetName'], val['streetNumber'], val['postal'], val['country']];
        let query = mysql.createQuery("INSERT INTO location (id_location, city, street_name, street_number, postal, country) VALUES (?)", [values]);
        console.log('save, ' + query.sql);
        console.log(values);
        con.query(query, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
        });
        con.query("UPDATE person SET id_location=? WHERE id_person=?", [locationID, req.session.user.id_person],
            function (err, result) {
                if (err) throw err;
            });
    });
    res.redirect("/home");
});

app.post('/addContact', urlencodedParser, function (req, res) {
    let querySelect = "SELECT MAX(id_contact) as maxID FROM contact";
    let contactID = null;
    ssn = req.session;
    con.query(querySelect, function (error, results, fields){
        if (error) throw error;
        contactID = checkForID(contactID, results);
        querySelect = "SELECT MAX(id_contact_type) as maxID FROM contact_type";
        let contactTypeID = null;
        con.query(querySelect, function (error, results, fields){
            if (error) throw error;
            let val = req.body;
            contactTypeID = checkForID(contactTypeID, results);
            let insertContact = true;
            con.query("SELECT id_contact_type FROM contact_type WHERE name=?", [val['contactType']],
                function (error, results, fields) {
                if (error) throw error;
                if (results.length > 0){
                    contactTypeID = results[0].id_contact_type;
                    insertContact = false;
                }
                let values = [contactID, ssn.user.id_person, contactTypeID, val['contactDesc']];
                let query = mysql.createQuery("INSERT INTO contact (id_contact, id_person, id_contact_type, contact) VALUES (?)", [values]);
                console.log('save, ' + query.sql);
                console.log(values);
                con.query(query, function (err, result) {
                    if (err) throw err;
                    console.log("1 record inserted");
                });
                if (insertContact){
                    values = [contactTypeID, val['contactType'], "temp"];
                    query = mysql.createQuery("INSERT INTO contact_type (id_contact_type, name, validation_regexp) VALUES (?)", [values]);
                    console.log('save, ' + query.sql);
                    console.log(values);
                    con.query(query, function (err, result) {
                        if (err) throw err;
                        console.log("1 record inserted");
                    });
                }
            });
        });
    });
    res.redirect('/home');
});

app.post('/relation', urlencodedParser, function (req, res) {
    let querySelect = "SELECT MAX(id_relation) as maxID FROM relation";
    let relationID = null;
    ssn = req.session;
    con.query(querySelect, function (error, results, fields){
        if (error) throw error;
        relationID = checkForID(relationID, results);
        querySelect = "SELECT MAX(id_relation_type) as maxID FROM relation_type";
        let relationTypeID = null;
        con.query(querySelect, function (error, results, fields){
            if (error) throw error;
            let val = req.body;
            relationTypeID = checkForID(relationTypeID, results);
            let insertRelationType = true;
            con.query("SELECT id_relation_type FROM relation_type WHERE name=?", [val['relationType']],
                function (error, results, fields) {
                    if (error) throw error;
                    if (results.length > 0){
                        relationTypeID = results[0].id_relation_type;
                        insertRelationType = false;
                    }
                    con.query("SELECT id_person FROM person WHERE nickname=?", [val['person']],
                        function (error, results, fields) {
                            let values = [relationID, ssn.user.id_person, results[0].id_person, val['relationDesc'], relationTypeID];
                            let query = mysql.createQuery("INSERT INTO relation (id_relation, id_person1, id_person2, description, id_relation_type) VALUES (?)", [values]);
                            console.log('save, ' + query.sql);
                            console.log(values);
                            con.query(query, function (err, result) {
                                if (err) throw err;
                                console.log("1 record inserted");
                            });
                            if (insertRelationType){
                                values = [relationTypeID, val['relationType']];
                                query = mysql.createQuery("INSERT INTO relation_type (id_relation_type, name) VALUES (?)", [values]);
                                console.log('save, ' + query.sql);
                                console.log(values);
                                con.query(query, function (err, result) {
                                    if (err) throw err;
                                    console.log("1 record inserted");
                                });
                            }
                        });
            });
        });
    });
    res.redirect('/home');
});

app.post('/meeting', urlencodedParser, function (req, res) {
    let querySelect = "SELECT MAX(id_meeting) as maxID FROM meeting";
    let meetingID = null;
    ssn = req.session;
    con.query(querySelect, function (error, results, fields){
        if (error) throw error;
        meetingID = checkForID(meetingID, results);
        let val = req.body;
        con.query("SELECT id_location FROM location WHERE city = ?", [val['meetingLocation']],
            function (error, results, fields){
                let values = [meetingID, val['meetingStart'], val['meetingDesc'], val['meetingDuration'], results[0].id_location];
                let query = mysql.createQuery("INSERT INTO meeting (id_meeting, start, description, duration, id_location) VALUES (?)", [values]);
                console.log('save, ' + query.sql);
                console.log(values);
                con.query(query, function (err, result) {
                    if (err) throw err;
                    console.log("1 record inserted");
                });
                values = [ssn.user.id_person, meetingID];
                query = mysql.createQuery("INSERT INTO person_meeting (id_person, id_meeting) VALUES (?)", [values]);
                console.log('save, ' + query.sql);
                console.log(values);
                con.query(query, function (err, result) {
                    if (err) throw err;
                    console.log("1 record inserted");
                });
            });
    });
    res.redirect('/home');
});

app.post('/joinMeeting', urlencodedParser, function (req, res) {
    ssn = req.session;
    let val = req.body;
    let values = null;
    for (let i in val){
        values = [ssn.user.id_person, i];
        let query = mysql.createQuery("INSERT INTO person_meeting (id_person, id_meeting) VALUES (?)", [values]);
        con.query(query, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
        });
    }

    res.redirect('/home');
});

checkForID = (id, results) => {
    id = results[0].maxID;
    if (id == null){
        id = 0;
    }
    else{
        id++;
    }
    return id;
};

checkForContactType = (inputName, contactTypeID) => {

};

app.listen(port, () => {
    console.log(`The web server has started on port http://${localHost}:${port}`);
});