const express = require('express')
const mysql = require('mysql')
const dbconfig = require('./config/database.js')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const static = require('serve-static')
const { swaggerUi, specs } = require('./swaggerDoc')
const jwt = require('jsonwebtoken');
require("dotenv").config()

const secretKey = process.env.SECRET_KEY;
const algorithm = process.env.JWT_ALG;
const expiresIn = process.env.JWT_EXP;
const issuer = process.env.JWT_ISSUER;

const option = { algorithm, expiresIn, issuer };

const makeToken = (payload) => {
  return jwt.sign(payload, secretKey, {expiresIn: 60});
}

const decodePayload = (token) => {
  return jwt.verify(token, secretKey);
}

const auth = (req, res, next) => {
	try{
		const uid = decodePayload(req.params.token)
		req.data = {...req.data, uid: uid.uid}
	} catch(e) {
		req.data = {...req.data, msg: "로그인을 다시해주세요"}
	}
	next()
}

const port = process.env.PORT || 80
const app = express()

let connection

function handleDisconnect() {
	connection = mysql.createConnection(dbconfig)

	connection.connect(function(err) {
		if(err) {
			console.log('error when connecting to db:', err)
			setTimeout(handleDisconnect, 5000)
		}
	});

	connection.on('error', function(err) {
		console.log('db error', err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST') {
			handleDisconnect()
		} else {
			throw err
		}
	});
}

handleDisconnect()

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

app.use(static(__dirname))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs))

app.get('/:token', auth ,(req, res) => {
	console.log(req.data)
	res.send('Hello! this is saessac\'s api server!')
})

app.get('/error/:msg', (req, res) => {
	res.json({msg: req.params.msg})
})

/**
 * @swagger
 * /user/checkid:
 *  get:
 *    summary: "아이디 중복여부 확인"
 *    description: "요청 경로에 쿼리로 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    parameters:
 *      - in: query
 *        name: userid
 *        required: true
 *        description: 유저 아이디
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (아이디 중복여부 검사)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                msg:
 *                  type: boolean
 */

app.get('/user/checkid', (req, res) => {
	connection.query(`SELECT COUNT(userID) FROM Users WHERE userID='${req.query.userid}'`, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else {
			if(row[0]["COUNT(userID)"] === 0){
				res.json({msg: true})
			} else{
				res.json({msg: false})
			}
		}
	})
})

/**
 * @swagger
 * /user/insert:
 *  post:
 *    summary: "회원가입 기능"
 *    description: "요청 경로에 바디에 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 등록)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              userid:
 *                type: string
 *                description: "유저 아이디"
 *              userpassword:
 *                type: string
 *                description: "유저 비밀번호"
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 등록)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number 
 *                msg:
 *                  type: string 
 */

app.post('/user/insert', (req, res) => {
	let body = req.body
	
	connection.query(`SELECT COUNT(userID) FROM Users WHERE userID=?`,[body.userid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else{
			if(row[0]["COUNT(userID)"] === 0){
				connection.query(`INSERT INTO Users (userID, userPassword) VALUES (?, SHA2(?, 256))`, [body.userid, body.userpassword], (err, row) => {
					if(err) res.redirect('/error/' + err.code)
					else res.json({insertId: row.insertId, msg: 'success'})
				})
			}else{
				res.json({msg: "중복된 아이디 입니다."})
			}
		}
	})
})

app.post('/user/picture/', (req, res) => {
	res.json({"msg" : "failed! please check endpoint"})
})

/**
 * @swagger
 * /user/picture/{user_uid}:
 *  post:
 *    summary: "프로필 사진 수정"
 *    description: "요청 경로에 값을 담아 서버에 보낸다. 본 문서상에서는 실행 불가능"
 *    tags: [Users]
 *    parameters:
 *      - in: path
 *        name: user_uid
 *        required: true
 *        description: 유저 고유 아이디 
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (프로필 사진 업로드)
 *      required: true
 *      content:
 *        multipart/form-data:
 *          schema:
 *            type: object
 *            properties:
 *                name:
 *                  type: string
 *                  format: binary
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (프로필 사진 업로드)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                msg:
 *                  type: string
 */

// 프로필사진 업로드
app.post('/user/picture/:id', upload.single('profilepicture'), (req, res, next) => {
	console.log('hello')
	if(req.file === undefined) {
		res.json({"msg" : "failed! picture not found"})
	} else {
		const { fieldname, originalname, encoding, mimetype, destination, filename, path, size } = req.file
		connection.query('SELECT * FROM Users WHERE uid=' + req.params.id, (err, row) => {
			if(err) res.redirect('/error/' + err.code)
			else {
				if(row.length){
					if(row[0].userPicture) fs.unlink(__dirname + row[0].userPicture, () => {console.log('prevPicture delete')})
					connection.query('UPDATE Users SET userPicture=? WHERE uid=?', [path.slice(30), req.params.id], (err, row) => {
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

/**
 * @swagger
 * /user/list:
 *  get:
 *    summary: "회원 목록 확인"
 *    description: "회원 목록 확인"
 *    tags: [Users]
 *    responses:
 *      "200":
 *        description: 회원 목록 확인
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                uid:
 *                  type: number
 *                userID:
 *                  type: string
 *                nickName:
 *                  type: string 
 *                info:
 *                  type: string
 *                userPicture:
 *                  type: string 
 */

app.get('/user/list', (req, res) => {
	connection.query('SELECT uid, userID, nickName, info, userPicture FROM Users', (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		// else res.send(JSON.stringify(...rows))
		else {
			res.json(rows)
		}
	})
});

/**
 * @swagger
 * /user/{user_uid}:
 *  get:
 *    summary: "회원 정보 확인"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    parameters:
 *      - in: path
 *        name: user_uid
 *        required: true
 *        description: 유저 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 조회)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                uid:
 *                  type: number
 *                name:
 *                  type: string
 *                userPicture:
 *                  type: string
 *                nickName:
 *                  type: string
 *                info:
 *                  type: string
 *                group_concat(locationName):
 *                  type: string
 */

app.get('/user/:uid', (req, res) => {
	let query = `SELECT uid, userID, userPicture, nickName, info, group_concat(locationName) FROM favoritLocation AS F INNER JOIN Users AS U ON F.Users_uid = U.uid INNER JOIN Location AS L ON F.Location_lid = L.lid WHERE U.uid = ${req.params.uid}`;
	connection.query(query, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			res.json(row)
    }
	})
});

/**
 * @swagger
 * /user/login:
 *  post:
 *    summary: "로그인"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (로그인)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              userid:
 *                type: string
 *                description: "유저 아이디"
 *              userpassword:
 *                type: string
 *                description: "유저 비밀번호"
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (로그인)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                uid:
 *                  type: number
 */

app.post('/user/login', (req, res) => {
	let body = req.body
	
	let query = `SELECT uid FROM Users WHERE userid='${body.userid}' AND userpassword=SHA2('${body.userpassword}', 256)`
	// let query = `SELECT uid FROM Users WHERE userID='${body.userid}' AND userPassword=SHA2('${body.userpassword}', 256)`;
	connection.query(query, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			if(row.length === 0) res.json({msg: 'failed'})
			else {
				const token = makeToken({"uid": row[0].uid, "userid": row[0].userID, "nickname": row[0].nickName}, )
				res.json({msg: 'success', token})
			}
    }
	})
});

/**
 * @swagger
 * /user/{user_uid}:
 *  put:
 *    summary: "회원정보 수정"
 *    description: "요청 경로에 패치 값과 바디 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    parameters:
 *      - in: path
 *        name: user_uid
 *        required: true
 *        description: 유저 고유 아이디
 *        schema:
 *          type: number
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (회원정보 수정)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              nickname:
 *                type: string
 *                description: "닉네임"
 *              info:
 *                type: string
 *                description: "자기소개"
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 수정)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number
 *                changedRows:
 *                  type: string
 */

app.put('/user/:id', (req, res) => {
	let userData = {}
	const body = req.body

	connection.query(`SELECT * FROM Users WHERE uid=${req.params.id}`, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			if(row.length === 0) res.json({msg: "falied"})
			else{
				userData = {
					nickname: row[0]['nickName'], 
					info: row[0]['info']
				}
				
				Object.keys(body).forEach((e) => {
					userData[e] = body[e]
				})
				
				connection.query('UPDATE Users SET nickName=?, info=? WHERE uid=?', [userData.nickname, userData.info, req.params.id], (err, row) => {
					if(err) res.redirect('/error/' + err.code)
					else res.json({insertId: row.insertId, changedRows: row.changedRows})
				})
			}
		}
	})
})

/**
 * @swagger
 * /user/password/{user_uid}:
 *  put:
 *    summary: "비밀번호 수정"
 *    description: "요청 경로에 패치 값과 바디 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    parameters:
 *      - in: path
 *        name: user_uid
 *        required: true
 *        description: 유저 고유 아이디
 *        schema:
 *          type: number
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (비밀번호 수정)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              currentuserpassword:
 *                type: string
 *                description: "현재 비밀번호"
 *              userpassword:
 *                type: string
 *                description: "변경할 비밀번호"
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 수정)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number
 *                changedRows:
 *                  type: string
 */

app.put('/user/password/:id', (req, res) => {
	let userData = {}
	const body = req.body

	connection.query(`SELECT * FROM Users WHERE uid=${req.params.id} AND userpassword=SHA2('${body.currentuserpassword}', 256)`, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			if(row.length === 0) res.json({msg: "falied"})
			else{
				userData = {
					userid: row[0]['userID'], 
					userpassword: row[0]['userPassword'],
				}
				
				Object.keys(body).forEach((e) => {
					userData[e] = body[e]
				})
				
				connection.query('UPDATE Users SET userid=?, userpassword=SHA2(?, 256) WHERE uid=?', [userData.userid, userData.userpassword, req.params.id], (err, row) => {
					if(err) res.redirect('/error/' + err.code)
					else res.json({insertId: row.insertId, changedRows: row.changedRows})
				})
			}
		}
	})
})

/**
 * @swagger
 * /user/{user_uid}:
 *  delete:
 *    summary: "회원 정보 삭제"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Users]
 *    parameters:
 *      - in: path
 *        name: user_uid
 *        required: true
 *        description: 유저 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (유저 삭제)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                affectedRows:
 *                  type: number
 */

app.delete('/user/:id', (req, res) => {
	connection.query('DELETE FROM Users WHERE uid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({affectedRows: row.affectedRows})
	})
});

// 게시글 작성

/**
 * @swagger
 * /topic/insert:
 *  post:
 *    summary: "게시물 작성 기능"
 *    description: "요청 경로에 바디에 값을 담아 서버에 보낸다."
 *    tags: [Topic]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 작성)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              topictitle:
 *                type: string 
 *              topiccontents:
 *                type: string 
 *              users_uid:
 *                type: number 
 *              location_lid:
 *                type: number 
 *              type:
 *                type: string 
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 작성)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number 
 *                msg:
 *                  type: string 
 */

app.post('/topic/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO Topic (topicTitle, topicContents, Users_uid, Location_lid, type) VALUES (?, ?, ?, ?, ?)`, [body.topictitle, body.topiccontents, body.users_uid, body.location_lid, body.type], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

/**
 * @swagger
 * /topic/list:
 *  get:
 *    summary: "게시글 목록 확인"
 *    description: "게시글 목록 확인"
 *    tags: [Topic]
 *    parameters:
 *      - in: query
 *        name: type
 *        required: false
 *        description: 게시글 타입
 *      - in: query
 *        name: recruit
 *        required: false
 *        description: 모집여부
 *    responses:
 *      "200":
 *        description: "게시글 목록 확인"
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                tid:
 *                  type: number
 *                topicTitle:
 *                  type: string
 *                topicContents:
 *                  type: string 
 *                uid:
 *                  type: number
 *                userID:
 *                  type: string
 *                created_at:
 *                  type: string 
 *                updated_at:
 *                  type: string
 *                userPicture:
 *                  type: string
 *                lid:
 *                  type: number 
 *                locationName:
 *                  type: string 
 */

app.get('/topic/list', (req, res) => {
	// let sort = req.query.sort || 'ASC'
	// let offset = req.query.offset || 0
	let type = req.query.type
	let recruit = req.query.recruit

	let sql = `SELECT tid, topicTitle, topicContents, uid, userID, Topic.created_at, Topic.updated_at, userPicture, lid, locationName FROM Topic LEFT JOIN Users ON Topic.Users_uid = Users.uid LEFT JOIN Location ON Topic.location_lid = Location.lid ${type ? "WHERE type=\"" + type + "\"" : ""} ${recruit ? "AND recruit=\"" + recruit + "\"" : ""}`
	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

/**
 * @swagger
 * /topic/{topic_tid}:
 *  get:
 *    summary: "게시글 정보 확인"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Topic]
 *    parameters:
 *      - in: path
 *        name: topic_tid
 *        required: true
 *        description: 게시글 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 조회)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                tid:
 *                  type: number
 *                topicTitle:
 *                  type: string
 *                topicContents:
 *                  type: string 
 *                uid:
 *                  type: number
 *                userID:
 *                  type: string
 *                created_at:
 *                  type: string 
 *                updated_at:
 *                  type: string
 *                userPicture:
 *                  type: string
 *                lid:
 *                  type: number 
 *                locationName:
 *                  type: string 
 */

app.get('/topic/:id', (req, res) => {
	let sql = `SELECT tid, topicTitle, topicContents, uid, userID, Topic.created_at, Topic.updated_at, userPicture, lid, locationName, topicLike FROM Topic LEFT JOIN Users ON Topic.Users_uid = Users.uid LEFT JOIN Location ON Topic.location_lid = Location.lid WHERE tid=${req.params.id}`
	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

/**
 * @swagger
 * /topic/{topic_tid}:
 *  put:
 *    summary: "게시글 수정"
 *    description: "요청 경로에 패치 값과 바디 값을 담아 서버에 보낸다."
 *    tags: [Topic]
 *    parameters:
 *      - in: path
 *        name: topic_tid
 *        required: true
 *        description: 게시글 고유 아이디
 *        schema:
 *          type: number
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 수정)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              topictitle:
 *                type: string
 *                description: "게시글 제목"
 *              topiccontents:
 *                type: string
 *                description: "게시글 내용"
 *              uid:
 *                type: number
 *                description: "작성자 고유 아이디"
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 수정)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number
 *                changedRows:
 *                  type: string
 */

app.put('/topic/:id', (req, res) => {
	let topicData = {}
	const body = req.body

	let sql = `SELECT topicTitle, topicContents, Users_uid FROM Topic WHERE tid=${req.params.id}`
	connection.query(sql, (err, row) => {
    if(err) res.redirect('/error/' + err.code)
    else {
			if(Number(body.uid) === row[0]["Users_uid"]){
				topicData = {
					topictitle: row[0]['topicTitle'],
					topiccontents: row[0]['topicContents']
				}
				
				Object.keys(body).forEach((e) => {
					topicData[e] = body[e]
				})
				
				connection.query('UPDATE Topic SET topicTitle=?, topicContents=? WHERE tid=?', [topicData.topictitle, topicData.topiccontents, req.params.id], (err, row) => {
					if(err) res.redirect('/error/' + err.code)
					else res.json({insertId: row.insertId, changedRows: row.changedRows})
				})
			} else {
				res.json({"msg": "User does not match"})
			}
		}
	})
})

/**
 * @swagger
 * /topic/{topic_tid}:
 *  delete:
 *    summary: "게시글 삭제"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Topic]
 *    parameters:
 *      - in: path
 *        name: topic_tid
 *        required: true
 *        description: 게시글 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 삭제)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                comments:
 *                  type: object
 *                topic:
 *                  type: object
 */

app.delete('/topic/:id', (req, res) => {
	let msg = {}
	connection.query('DELETE FROM topicComents WHERE Topic_tid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else msg = {comments: {affectedRows: row.affectedRows}}
	})

	connection.query('DELETE FROM Topic WHERE tid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else {
			msg = {...msg, topic: {affectedRows: row.affectedRows}}
			res.json(msg)
		}
	})
});

// 게시글 작성 완료

// 게시글 댓글 기능

// id = topic의 tid

/**
 * @swagger
 * /topiccomments/insert:
 *  post:
 *    summary: "댓글 작성 기능"
 *    description: "요청 경로에 바디에 값을 담아 서버에 보낸다."
 *    tags: [TopicComments]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (댓글 작성)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              topiccomment:
 *                type: string 
 *              topic_tid:
 *                type: number 
 *              users_uid:
 *                type: number 
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (댓글 작성)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number 
 *                msg:
 *                  type: string 
 */

app.post('/topiccomments/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO topicComents (topicComent, Topic_tid, Users_uid) VALUES (?, ?, ?)`, [body.topiccomment, body.topic_tid, body.users_uid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

/**
 * @swagger
 * /topiccomments/{topic_tid}:
 *  get:
 *    summary: "댓글 확인"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [TopicComments]
 *    parameters:
 *      - in: path
 *        name: topic_tid
 *        required: true
 *        description: 게시글 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (댓글 조회)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                tcid:
 *                  type: number
 *                topicComent:
 *                  type: string
 *                created_at:
 *                  type: string 
 *                updated_at:
 *                  type: string
 *                tid:
 *                  type: number 
 *                Location_lid:
 *                  type: number 
 *                uid:
 *                  type: number 
 *                userID:
 *                  type: string 
 *                userPicture:
 *                  type: string 
 */

app.get('/topiccomments/:id', (req, res) => {
	let sort = req.query.sort || 'ASC'
	let offset = req.query.offset || 0
	let sql = `SELECT tcid, topicComent, topicComents.created_at, topicComents.updated_at, tid, Location_lid, uid, userID, userPicture FROM topicComents LEFT JOIN Topic ON topicComents.Topic_tid = Topic.tid LEFT JOIN Users ON topicComents.Users_uid = Users.uid WHERE Topic_tid=${req.params.id} ORDER BY topicComents.tcid ${sort} LIMIT 10 OFFSET ${offset}`

	connection.query(sql, (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

/**
 * @swagger
 * /topiccomments/{topiccomments_tcid}:
 *  delete:
 *    summary: "댓글 삭제"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [TopicComments]
 *    parameters:
 *      - in: path
 *        name: topic_tcid
 *        required: true
 *        description: 댓글 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (게시글 삭제)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                affectedRows:
 *                  type: number
 */

app.delete('/topiccomments/:id', (req, res) => {
	connection.query('DELETE FROM topicComents WHERE tcid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({affectedRows: row.affectedRows})
	})
})

// 게시글 댓글 기능 완료

// 운동 장소 관련

/**
 * @swagger
 * /location/insert:
 *  post:
 *    summary: "장소 추가 기능"
 *    description: "요청 경로에 바디에 값을 담아 서버에 보낸다."
 *    tags: [Location]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (장소 추가)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              locationname:
 *                type: string 
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (장소 추가)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number 
 *                msg:
 *                  type: string 
 */

app.post('/Location/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO Location (locationName) VALUES (?)`, [body.locationname], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

/**
 * @swagger
 * /location/list:
 *  get:
 *    summary: "장소 목록 확인"
 *    description: "장소 목록 확인"
 *    tags: [Location]
 *    responses:
 *      "200":
 *        description: 장소 목록 확인
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                lid:
 *                  type: number
 *                locationName:
 *                  type: string
 */

app.get('/location/list', (req, res) => {
	let body = req.body

	connection.query(`SELECT * FROM Location`, [body.locationname], (err, rows) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json(rows)
	})
})

/**
 * @swagger
 * /location/{location_lid}:
 *  delete:
 *    summary: "장소 삭제"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Location]
 *    parameters:
 *      - in: path
 *        name: location_lid
 *        required: true
 *        description: 장소 고유 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (장소 삭제)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                affectedRows:
 *                  type: number
 */

app.delete('/location/:id', (req, res) => {
	connection.query('DELETE FROM Location WHERE lid=' + req.params.id, (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({affectedRows: row.affectedRows})
	})
})

// 좋아하는 장소 추가

/**
 * @swagger
 * /favoritlocation/insert:
 *  post:
 *    summary: "좋아하는 장소 추가 기능"
 *    description: "요청 경로에 바디에 값을 담아 서버에 보낸다."
 *    tags: [Favoritlocation]
 *    requestBody:
 *      description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (좋아하는 장소 추가)
 *      required: true
 *      content:
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              userid:
 *                type: number 
 *              locationid:
 *                type: number 
 *    responses:
 *      "201":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (좋아하는 장소 추가)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                insertId:
 *                  type: number 
 *                msg:
 *                  type: string 
 */

app.post('/favoritlocation/insert', (req, res) => {
	let body = req.body

	connection.query(`INSERT INTO favoritLocation (Users_uid, Location_lid) VALUES (?, ?)`, [body.userid, body.locationid], (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({insertId: row.insertId, msg: 'success'})
	})
})

/**
 * @swagger
 * /favoritlocation:
 *  delete:
 *    summary: "좋아하는 장소 삭제"
 *    description: "요청 경로에 패치 값을 담아 서버에 보낸다."
 *    tags: [Favoritlocation]
 *    parameters:
 *      - in: query
 *        name: uid
 *        required: true
 *        description: 유저 아이디
 *        schema:
 *          type: number
 *      - in: query
 *        name: lid
 *        required: true
 *        description: 로케이션 아이디
 *        schema:
 *          type: number
 *    responses:
 *      "200":
 *        description: 사용자가 서버로 전달하는 값에 따라 결과 값은 다릅니다. (좋아하는 장소 삭제)
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                affectedRows:
 *                  type: number
 */

app.delete('/favoritlocation', (req, res) => {
	let sql = `DELETE FROM favoritLocation WHERE Users_uid=? AND Location_lid=?`
	connection.query(sql, [req.query.uid, req.query.lid] , (err, row) => {
		if(err) res.redirect('/error/' + err.code)
		else res.json({affectedRows: row.affectedRows})
	})
})

// 데이터베이스 외래키 관계 확인

app.listen(port, () => {
	console.log(`server is listening at localhost:${port}`)
});
