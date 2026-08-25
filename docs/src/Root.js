import {AddStyle} from './Styles.js';
import Game from './Game.js';

AddStyle(`
    game-root{
        display: flex;
        width: 100vw;
        height: 100vh;
        margin: 0;
        font-family: sans-serif;
    }

    game-root .title-menu-view{
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    game-root .header{
        display: flex;
        color: steelblue;
        font-size: 50px;
        font-weight: bold;
        position: absolute;
        top: 0;
    }

    game-root .input-button-container{
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 40px;
    }

    game-root .input-button{
        padding: 5px;
        border: 1px solid black;
        border-radius: 3px;
        font-size: 18px;
    }

    game-root .username{
        display: flex;
        background-color: lightgrey;
    }

    game-root .single-player, game-root .multiplayer{
        display: flex;
        justify-content: center;
        width: 80%;
        background-color: steelblue;
        color: white;
        cursor: pointer;
    }

    game-root .single-player:hover, game-root .multiplayer:hover{
        filter: brightness(0.7);
    }

    game-root .hidden{
        display: none;
    }
`);

class Root extends HTMLElement{
    constructor(){
        super();
        this.innerHTML = `
            <div class="title-menu-view">
                <div class="header">Orb Frenzy</div>
                <div class="input-button-container">
                    <input class="username input-button" placeholder="Name" spellcheck="false"></input>
                    <button class="single-player input-button">Single Player Mode</button>
                    <button class="multiplayer input-button">Multiplayer Mode</button>
                </div>
            </div>
        
            <game-core class="hidden"></game-core>
        `;
        
        const titleMenuView = this.querySelector('.title-menu-view');
        const game = this.querySelector('game-core');
                        
        this.querySelector('.single-player').addEventListener('click', () => {
            titleMenuView.classList.add('hidden');
            game.classList.remove('hidden');
            game.startSinglePlayerGame();
        });
        
        this.querySelector('.multiplayer').addEventListener('click', () => {
            titleMenuView.classList.add('hidden');
            game.classList.remove('hidden');
            game.startMultiplayerGame();
        });
        
        this.addEventListener('gameOver', () => {
           titleMenuView.classList.remove('hidden');
           game.classList.add('hidden');
           window.location.reload();
        });
    };
};
customElements.define('game-root', Root);
