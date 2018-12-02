

module.exports = (app, io, rooms) => {
    app.get('/lobby', (req, res) => {
        console.log("lobby post was called")
        var connected = false
        var room = rooms[req.cookies.room]

        onPlayerFirstConnect = (socket) => {
            let name = getCookie(socket, "player")

            //get current users in lobby
            socket.emit('get-curr-users', room.players)

            // let player = new Player(name, socket.id)
            // room.addPlayer(name, player)
            room.setSocketId(name, socket.id)
            socket.join(room.key)

            console.log("player in room", room.players[name]);


            // Notify that a new user has joined
            socket.to(room.key).emit('new-player', name)
        }
        onPlayerDisconnect = (socket) =>{
            room.removePlayer(socket.id)

            //update lobby page for everyone still connected
            socket.to(room.key).emit('player-disconnected', room.players)
        }

        onGameOwnerFirstConnect = (socket) => {
            room.setGameOwner(socket.id)
            socket.join(room.key)
        }
        onGameOwnerDisconnect = (socket) => {
            //disconnect and redirect everyone in room
            socket.to(room.key).emit('force-disconnect')
            
            delete rooms[req.cookies.room]
            console.log('state of room after disc', rooms)
        }

        getCookie = (socket, cookie) => {
            let cookies = socket.handshake.headers['cookie']
            let cookie_split = cookies.split("; ")

            for(let cookies of cookie_split){
                if(cookie === "player"){
                    if(cookies[0] === 'p'){
                        let player = cookies.split("=")
                        return player[1]
                    }
                }
                else if(cookie === "game_owner"){
                    if(cookies[0] === 'g'){
                        let game_owner = cookies.split("=")
                        return game_owner[1]
                    }
                }     
            }
        }

        io.sockets.on('connection', (socket) => {
            if(getCookie(socket, "game_owner") === "0"){
                //make sure to emit user has joined only once
                if(!connected){
                    onPlayerFirstConnect(socket)
                    connected = true
                }
            }    
            else if(getCookie(socket, "game_owner") === "1"){
                if(!connected){
                    onGameOwnerFirstConnect(socket)
                    connected = true
                }
            }

            socket.on('start-time', () => {                
                // Start the timer for that specific room
                room.startTimer(socket);
            })

            socket.on('disconnect', () => {
                //if the countdown timer hasnt gone down yet all the way and someone disconnects,
                //do everything as originally intended
                if(room.time > 1){
                    //when room doesn't exist anymore (after game owner disconnects),
                    //ignore if is game owner or not, just disconnect
                    if(room){
                        if(getCookie(socket, "game_owner") === "1"){
                            onGameOwnerDisconnect(socket)
                        }
                        else{
                            //if room still exists and player disconnects
                            onPlayerDisconnect(socket)
                        }
                    }
                }
            })

            socket.on('shuffle-teams', () => {
                room.shuffleTeams()

                socket.to(room.key).emit("shuffled-teams", room.teams)
                socket.emit("shuffled-teams", room.teams)
                console.log(room)
            })

            socket.on('kick', (who) => {
                //redirect user back to home, delete user from room object
                socket.to(room.players[who].socketid).emit('force-disconnect')
                delete room.players[who]

                socket.emit('get-curr-users', room.players)
                socket.to(room.key).emit('get-curr-users', room.players)
            })
        })
        res.sendStatus(200)
  })
}