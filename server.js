const express = require('express')
const mysql = require('mysql')
const dbconfig = require('./config/database.js')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const static = require('serve-static');

const port = process.env.PORT || 80;
const app = express();
const connection = mysql.createConnection(dbconfig)
const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, __dirname + '/src/profilepicture/') // 파일 업로드 경로
	},
	filename: function (req, file, callback) {
		callback(null, file.fieldname + Date.now() + ".png") //파일 이름 설정
	}
})
const upload = multer({
	storage
})

app.use(static(__dirname));
app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
	res.send('Hello! this is saessac\'s api server!')
})

app.get('/error/:msg', (req, res) => {
	res.json({msg: req.params.msg})
})

app.post('/user/insert', (req, res) => {
	let body = req.body
	connection.query(`INSERT INTO Users (userID, userPassword, userPicture) VALUES (?, ?, ?)`, [body.userid, body.userpassword, body.userPicture], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

app.post('/user/picture/', (req, res) => {
	res.json({"msg" : "failed! please check endpoint"})
})

// 프로필사진 업로드
app.post('/user/picture/:id', upload.single('profilepicture'), (req, res, next) => {
	if(req.file === undefined) {
		res.json({"msg" : "failed! picture not found"})
	} else {
		const { fieldname, originalname, encoding, mimetype, destination, filename, path, size } = req.file

		connection.query('SELECT * FROM Users WHERE uid=' + req.params.id, (err, row) => {
			if(err) res.redirect('/error/' + err.code)
			else {
				if(row.length){
					if(row[0].userPicture) fs.unlink(row[0].userPicture, () => {console.log('prevPicture delete')})
					connection.query('UPDATE Users SET userPicture=? WHERE uid=?', [path, req.params.id], (err, row) => {
						if(err) res.redirect('/error/' + err.code)
						else res.json({"msg" : `success! filename is ${filename}`})
					})
				} else {
					fs.unlink(path, () => {
						res.json({"msg" : "failed! user not found"})
					})
				}
			}
		})
	}
})

app.get('/user/list', (req, res) => {
	connection.query('SELECT uid, userID, userPicture FROM Users', (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		// else res.send(JSON.stringify(...rows))
		else {
			res.json(rows)
		}
	})
});

app.get('/user/:id', (req, res) => {
	connection.query('SELECT uid, userID, userPicture FROM Users WHERE uid=' + req.params.id, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    // else res.send(JSON.stringify({...row, msg: 'success'}))
	  // else res.send(JSON.stringify("{\"msg\": \"hello\"}"))
    else {
      // JSON.stringify()
			res.json(row)
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
				else res.json(row)
			})
		}
	})
})

app.delete('/user/:id', (req, res) => {
	connection.query('DELETE FROM Users WHERE uid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(row)
	})
});

// 게시글 작성

app.post('/topic/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO Topic (topicTitle, topicContents, Users_uid, Location_lid) VALUES (?, ?, ?, ?)`, [body.topictitle, body.topiccontents, body.users_uid, body.location_lid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

app.get('/topic/list', (req, res) => {
	let sort = req.query.sort || 'ASC'
	let offset = req.query.offset || 0
	let sql = `SELECT tid, topicTitle, topicContents, uid, userID, Topic.created_at, Topic.updated_at, userPicture, lid, locationName FROM Topic LEFT JOIN Users ON Topic.Users_uid = Users.uid LEFT JOIN Location ON Topic.location_lid = Location.lid ORDER BY Topic.tid ${sort} LIMIT 10 OFFSET ${offset}`

	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

app.get('/topic/:id', (req, res) => {
	let sql = `SELECT tid, topicTitle, topicContents, uid, userID, Topic.created_at, Topic.updated_at, userPicture, lid, locationName FROM Topic LEFT JOIN Users ON Topic.Users_uid = Users.uid LEFT JOIN Location ON Topic.location_lid = Location.lid WHERE tid=${req.params.id}`
	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

app.put('/topic/:id', (req, res) => {
	let topicData = {}
	const body = req.body

	let sql = `SELECT topicTitle, topicContents, Users_uid FROM Topic WHERE tid=${req.params.id}`
	connection.query(sql, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			if(body.uid === row[0]["Users_uid"]){
				topicData = {
					topictitle: row[0]['topicTitle'],
					topiccontents: row[0]['topicContents']
				}
				
				Object.keys(body).forEach((e) => {
					topicData[e] = body[e]
				})
				
				connection.query('UPDATE Topic SET topicTitle=?, topicContents=? WHERE tid=?', [topicData.topictitle, topicData.topiccontents, req.params.id], (err, row) => {
					if(err) res.redirect('/error/' + err.code)
					else res.json(row)
				})
			} else {
				res.json({"msg": "User does not match"})
			}
		}
	})
})

app.delete('/topic/:id', (req, res) => {
	let msg = []
	connection.query('DELETE FROM topicComents WHERE Topic_tid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else msg.push(row)
	})

	connection.query('DELETE FROM Topic WHERE tid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else {
			msg.push(row)
			res.json(msg)
		}
	})
});

// 게시글 작성 완료

// 게시글 댓글 기능

// id = topic의 tid

app.post('/topiccomments/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO topicComents (topicComent, Topic_tid, Users_uid) VALUES (?, ?, ?)`, [body.topiccomment, body.topic_tid, body.users_uid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

app.get('/topiccomments/:id', (req, res) => {
	let sort = req.query.sort || 'ASC'
	let offset = req.query.offset || 0
	let sql = `SELECT tcid, topicComent, topicComents.created_at, topicComents.updated_at, tid, Location_lid, uid, userID, userPicture FROM topicComents LEFT JOIN Topic ON topicComents.Topic_tid = Topic.tid LEFT JOIN Users ON topicComents.Users_uid = Users.uid WHERE Topic_tid=${req.params.id} ORDER BY topicComents.tcid ${sort} LIMIT 10 OFFSET ${offset}`

	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

app.delete('/topiccomments/:id', (req, res) => {
	connection.query('DELETE FROM topicComents WHERE tcid=' + req.params.id, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

// 게시글 댓글 기능 완료

// 데이터베이스 외래키 관계 확인

app.listen(port, () => {
	console.log(`server is listening at localhost:${port}`)
});
