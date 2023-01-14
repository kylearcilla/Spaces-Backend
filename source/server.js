import express from "express";
import cors from "cors";
import SpotifyWebApi from "spotify-web-api-node";
import mysql from "mysql2";
import dotenv from "dotenv";
import { generateToken, verifyToken } from "./auth.js";

dotenv.config();
let port = process.env.PORT || 3001;

let server = express();
let db = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DB,
});

server.use(cors());
server.use(express.json());

server.get("/login/:email", (req, res) => {
  let params = req.params;
  let query = `SELECT * FROM users WHERE google_email = '${params.email}'`;

  db.query(query, (err, result) => {
    if (err) {
      let errorCode = err.code;
      res.send({
        error: {
          code: errorCode,
        },
      });
      return;
    }
    let token = generateToken(params.email);
    res.send({
      user: result,
      token,
    });
  });
});

server.post("/register", (req, res) => {
  let query = `INSERT INTO 
    users(
      google_email
    )
    values (
     '${req.body.email}'
    )`;

  db.query(query, (err) => {
    if (err) {
      let errorCode = err.code;
      res.send({
        error: {
          code: errorCode,
        },
      });
      return;
    }
    let token = generateToken(req.body.email);
    res.send({
      token,
    });
  });
});

server.post("/new-session", (req, res) => {
  let { hasError, response } = verifyToken(req);
  if (hasError) {
    res.send({
      error: {
        message: response,
      },
    });
    return;
  }
  let new_session = req.body.new_session;
  let query = `INSERT INTO 
    sessions(
      name, 
      date_created, 
      pomodoro_period,
      cycles,
      time_period, 
      score, 
      owner_email
    )
    values(
      '${new_session.name}', 
      '${new_session.date_created}', 
      '${new_session.pomodoro_period}', 
      '${new_session.cycles}', 
      '${new_session.time_period}', 
      '${new_session.score}', 
      '${new_session.owner_email}'
    );`;

  db.query(query, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

server.post("/replace", (req, res) => {
  let { hasError, response, decodedToken = {} } = verifyToken(req);
  let userEmail = (decodedToken).email;
  if (hasError) {
    res.send({
      error: {
        message: response,
      },
    });
    return;
  }
  if (userEmail !== req.body.old_email) {
    res.send({
      error: {
        message: "Action not allowed.",
      },
    });
    return;
  }
  let query = `UPDATE users 
      SET google_email = '${req.body.new_email}'
      WHERE google_email = '${req.body.old_email}'
  ;`;

  db.query(query, (err, result) => {
    if (err) throw err;
    if (result.affectedRows === 0) {
      res.send({
        error: {
          message: "That user does not exist",
        },
      });
      return;
    }
    let token = generateToken(req.body.new_email);
    res.send({
      token,
    });
  });
});

server.post("/delete", (req, res) => {
  let { hasError, response, decodedToken = {} } = verifyToken(req);
  let userEmail = (decodedToken).email;
  if (hasError) {
    res.send({
      error: {
        message: response,
      },
    });
    return;
  }
  if (userEmail !== req.body.email) {
    res.send({
      error: {
        message: "Action not Allowed",
      },
    });
    return;
  }
  let query = `DELETE FROM users WHERE google_email = '${req.body.email}';`;
  db.query(query, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

server.get("/get-sessions/:email", (req, res) => {
  let { hasError, response, decodedToken = {} } = verifyToken(req);
  let userEmail = (decodedToken).email;
  if (hasError) {
    res.send({
      error: {
        message: response,
      },
    });
    return;
  }
  let params = req.params;
  if (userEmail !== params.email) {
    res.send({
      error: {
        message: "Action not Allowed",
      },
    });
    return;
  }
  let query = `SELECT * FROM sessions 
       WHERE owner_email = '${params.email}';
  `;
  db.query(query, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

server.post("/spotify-login", (req, res) => {
  let code = req.body.code;
  let spotifyWebApi = new SpotifyWebApi({
    redirectUri: "https://spaces-app.netlify.app/home/spotify",
    clientId: "0d42e1f4fea548bcae8fe6c75daea669",
    clientSecret: "a12c4d20747a4bdaac5277115c73de76",
  });

  spotifyWebApi
    .authorizationCodeGrant(code)
    .then((data) => {
      res.json({
        accessToken: data.body.access_token,
        refreshToken: data.body.refresh_token,
        expiresIn: data.body.expires_in,
      });
    })
    .catch(() => {
      res.sendStatus(400);
    });
});

server.post("/spotify-refresh", (req, res) => {
  let refreshToken = req.body.refreshToken;
  let spotifyWebApi = new SpotifyWebApi({
    redirectUri: "https://spaces-app.netlify.app/home/spotify",
    clientId: "0d42e1f4fea548bcae8fe6c75daea669",
    clientSecret: "a12c4d20747a4bdaac5277115c73de76",
    refreshToken,
  });

  spotifyWebApi
    .refreshAccessToken()
    .then((data) => {
      res.json({
        accessToken: data.body.access_token,
        expiresIn: data.body.expires_in,
      });
    })
    .catch(() => {
      res.sendStatus(400);
    });
});

server.listen(port, () => {
  console.log("App is listening on port " + port);
});

// node source/server