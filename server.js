const express = require('express')
const mysql = require('mysql')
const dbconfig = require('./config/database.js')
const cors = require('cors')

const connection = mysql.createConnection(dbconfig)
const app = express();
const port = process.env.PORT || 80;

app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
	res.send('Hello! this is saessac\'s api server!')
})

app.get('/error/:msg', (req, res) => {
	res.send({msg: req.params.msg})
})

app.post('/user/insert', (req, res) => {
	let body = req.body
	connection.query(`INSERT INTO Users (userID, userPassword, userPicture) VALUES (?, ?, ?)`, [body.userid, body.userpassword, body.userPicture], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.send({insertId: row.insertId, msg: 'success'})
	})
})

app.get('/user/list', (req, res) => {
	connection.query('SELECT * FROM Users', (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		// else res.send(JSON.stringify(...rows))
		else {
			// const result = []
			// rows.forEach(e => {
			// 	result.push(JSON.stringify(e))
			// })
			// console.log(result)
			// res.send(result)
			console.log(req.query.id, req.query.name)
			res.send(JSON.stringify(rows))
		}
	})
});

app.get('/user/:id', (req, res) => {
	connection.query('SELECT * FROM Users WHERE uid=' + req.params.id, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    // else res.send(JSON.stringify({...row, msg: 'success'}))
	  // else res.send(JSON.stringify("{\"msg\": \"hello\"}"))
    else {
      // JSON.stringify()
      res.send(JSON.stringify(row))
    }
	})
});

app.put('/user/:id', (req, res) => {
	let userData = {}
	const body = req.body

	connection.query('SELECT * FROM Users WHERE uid=' + req.params.id, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			userData = {
				userid: row[0]['userID'], 
				userpassword: row[0]['userPassword'],
				userpicture: row[0]['userPicture']
			}
			
			Object.keys(body).forEach((e) => {
				userData[e] = body[e]
			})
			
			connection.query('UPDATE Users SET userid=?, userpassword=?, userPicture=? WHERE uid=?', [userData.userid, userData.userpassword, userData.userpicture, req.params.id], (err, row) => {
				if(err) res.redirect('/error/' + err.code)
				else res.send(JSON.stringify(row))
			})
		}
	})
})

app.delete('/user/:id', (req, res) => {
	connection.query('DELETE FROM Users WHERE uid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.send(JSON.stringify(row))
	})
});

app.post('/topic/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO Topic (topicTitle, topicContents, Users_uid, Location_lid) VALUES (?, ?, ?, ?)`, [body.topictitle, body.topiccontents, body.users_uid, body.location_lid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.send({insertId: row.insertId, msg: 'success'})
	})
})

app.get('/topic/list', (req, res) => {
	let sql = 'SELECT topicTitle, topicContents, userID, locationName FROM topic LEFT JOIN users ON topic.Users_uid = users.uid LEFT JOIN location ON topic.location_lid = location.lid'
	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.send(JSON.stringify(rows))
	})
})

app.get('/topic/:id', (req, res) => {
	let sql = `SELECT topicTitle, topicContents, userID, locationName FROM topic LEFT JOIN users ON topic.Users_uid = users.uid LEFT JOIN location ON topic.location_lid = location.lid WHERE tid=` + req.params.id
	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.send(JSON.stringify(rows))
	})
})

// 게시글 작성 완료

app.listen(port, () => {
	console.log(`server is listening at localhost:${port}`)
});
