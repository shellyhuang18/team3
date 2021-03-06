const Player = require('./utils/player.js')
const gameAssets = require('./utils/icons.js')
module.exports = (app, io, rooms) => {
    var on_lobby = false

    app.get('/lobby', (req, res) => {
        console.log("lobby post was called")

        on_lobby = true
        res.sendStatus(200)
    })

    var lobby_connected = []

    io.on('connection', (socket) => {
        getCookie = (cookie) => {
            let cookies = socket.handshake.headers['cookie']
            let cookie_split = cookies.split("; ")
    
            for(let cookies of cookie_split){
                if(cookie === "player"){
                    if(cookies[0] === 'p'){
                        let player = cookies.split("=")
                        return decodeURIComponent(player[1])
                    }
                }
                else if(cookie === "game_owner"){
                    if(cookies[0] === 'g'){
                        let game_owner = cookies.split("=")
                        return game_owner[1]
                    }
                }
                else if(cookie === "room"){
                    if(cookies[0] === 'r'){
                        let room = cookies.split("=")
                        return room[1]
                    }
                } 
            }
    
            return ""
        }

        

        if(on_lobby){
            console.log("calld lobby socket connect");
            
            var room = getCookie("room")
            var name = getCookie("player")
            var game_owner = getCookie("game_owner")


            if(rooms[room]){
                console.log("if room exists")
                if(game_owner === "0"){ //player
                    console.log("user is player")
                    if(rooms[room].players[name]){
                        console.log("you're ok")
                    }
                }
            }else{
                console.log("received invalid credentials")
                return io.to(socket.id).emit('invalid-credentials')
            }
    
            var room = rooms[getCookie("room")]
    
            onPlayerFirstConnect = () => {
                lobby_connected.push(socket.id)
                let name = getCookie("player")
        
                //get current users in lobby
                socket.emit('get-curr-users', room.players)
        
                // let player = new Player(name, socket.id)
                // room.addPlayer(name, player)
        
                room.setSocketId(name, socket.id)
                socket.join(room.key)
                
                // Notify that a new user has joined
                socket.to(room.key).emit('new-player', room.players)
            }
         
            onPlayerDisconnect = () =>{
                console.log("player diconnect called function");
                room.removePlayer(socket.id)
                
                //update lobby page for everyone still connected
                io.in(room.key).emit('player-disconnected', room.players)
            }
        
            onGameOwnerFirstConnect = () => {
                lobby_connected.push(socket.id)
        
                room.setGameOwner(socket.id)
                socket.join(room.key)

                io.to(room.game_owner).emit('team-num', room.settings.num_teams)
            }
            onGameOwnerDisconnect = () => {
                console.log("game onwe rdisoncet");
                //disconnect and redirect everyone in room
                io.to(room.key).emit('force-disconnect')
                
                delete rooms[getCookie("room")]
                console.log('state of room after disc', rooms)
            }
    
            //make sure to emit user has joined only once
            if(lobby_connected.indexOf(socket.id) === -1){
                if(getCookie("game_owner") === "0"){
                    onPlayerFirstConnect()
                }    
                else if(getCookie("game_owner") === "1"){
                    onGameOwnerFirstConnect()
                }
            }
    
            socket.on('start-time', () => {                
                // Start the timer for that specific room
                room.startTimer(socket);
            })
    
            socket.on('disconnect', () => {
                console.log("somsone disconecte din lobby")
                //when room doesn't exist anymore (after game owner disconnects),
                //ignore if is game owner or not, just disconnect
                if(room){
                    //if the countdown timer hasnt gone down yet all the way and someone disconnects,
                    //do everything as originally intended
                    if(room.time > 0) {
                        if(room.game_owner === socket.id){
                            onGameOwnerDisconnect()
                        }
                        else{
                            //if room still exists and player disconnects
                            onPlayerDisconnect()
                        }
                    }  
                }
                
            })
    
            socket.on('shuffle-teams', () => {
                room.shuffleTeams()
    
                socket.to(room.key).emit("shuffled-teams", room.teams)
                socket.emit("shuffled-teams", room.teams)
                // console.log(room)
            })
    
            socket.on('kick', (who) => {
                //redirect user back to home, delete user from room object
                io.to(room.players[who].socketid).emit('force-disconnect')
                // delete room.players[who]
                
                io.in(room.key).emit('get-curr-users', room.players)
            })

            socket.on('request-icons', () => {
                let icons = gameAssets.enumerateIcons()
                console.log(icons)
                socket.emit('game-icons', icons)
            })
            //server version of componentWillUnmount
            on_lobby = false
        }  
    })
}