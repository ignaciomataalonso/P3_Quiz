const Sequelize = require('sequelize');
const {log, biglog, errorlog, colorize} = require("./out");
const {models} = require('./model');

exports.helpCmd = rl => {
    log("Commandos:");
    log(" h|help - Muestra esta ayuda.");
    log(" list - Listar los quizzes existentes.");
    log(" show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
    log(" add - Añadir un nuevo quiz interactivamente.");
    log(" delete <id> - Borrar el quiz indicado.");
    log(" edit <id> - Editar el quiz indicado.");
    log(" test <id> - Probar el quiz indicado.");
    log(" p|play -Jugar a preguntar aleatoriamente todos los quizzes.");
    log(" credits - Créditos.");
    log(" q|quit - Salir del programa.");
    rl.prompt();
};

exports.listCmd = rl => {

    models.quiz.findAll()
    .each(quiz => {
        log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    })
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });

};

const validateId = id => {

    return new Sequelize.Promise((resolve, reject) => {
        if (typeof id === "undefined") {
            reject(new Error(`Falta el parametro <id>.`));
        } else {
            id = parseInt(id);
            if (Number.isNaN(id)) {
                reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
                resolve(id);
            }
        }
    });

};

exports.showCmd = (rl, id) => {

    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if (!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);      
        }
        log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });

};

const makeQuestion = (rl, text) => {

    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};

exports.addCmd = rl => {

    makeQuestion(rl, ' Introduzca una pregunta: ')
    .then(q => {
        return makeQuestion(rl, ' Introduzca la respuesta ')
        .then(a => {
            return {question: q, answer: a};
        });
    })
    .then(quiz => {
        return models.quiz.create(quiz);
    })
    .then((quiz) => {
        log(` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog('El quiz es erroneo:');
        error.errors.forEach(({message}) => errorlog(message));
    })
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });
};

exports.deleteCmd = (rl, id) => {

    validateId(id)
    .then(id => models.quiz.destroy({where: {id}}))
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });

};

exports.editCmd = (rl, id) => {
    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if(!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
        return makeQuestion(rl, 'Introduzca la pregunta: ')
        .then(q => {
            process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
            return makeQuestion(rl, ' Introduzca la respuesta ')
            .then(a => {
                quiz.question = q;
                quiz.answer = a;
                return quiz;
            });
        });
    })
    .then(quiz => {
        return quiz.save();
    })
    .then(quiz => {
        log(`Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question}`);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog('El quiz es erroneo:');
        error.errors.forEach(({message}) => errorlog(message));
    })
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });
};

exports.testCmd = (rl, id) => {

    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if(!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        return makeQuestion(rl, ` ${colorize(quiz.question, 'red')}? `)
        .then(answer => {
            if (answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {
                log('Su respuesta es correcta.')
                biglog('Correcta', 'green');
                rl.prompt()
            } else {
                log('Su respuesta es incorrecta.')
                biglog('Incorrecta', 'red');
                rl.prompt();
            }
        })
    })
    .catch(error => {
        errorlog(error.message);
    })
    .then(() => {
        rl.prompt();
    });

};

exports.playCmd = rl => {

    let score = 0;
    let toBeResolved = [];

    const playOne = () => {
        return new Promise((resolve, reject) => {
            if (toBeResolved.length <= 0) {
                console.log("No hay nada mas que preguntar");
                console.log("Fin del examen.");
                console.log("Aciertos:");
                resolve();
                return;
            }
            let pos = Math.floor(Math.random() * toBeResolved.length);
            let quiz = toBeResolved[pos];
            toBeResolved.splice(pos, 1);
            makeQuestion(rl, quiz.question + '?')
            .then(answer => {
                if (answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {
                    score++;
                    log(`CORRECTO - Lleva ${score} aciertos.`);
                    resolve(playOne());
                } else {
                    log('INCORRECTO.');
                    log(`Fin del juego. Aciertos:`);
                    biglog(`${score}`, 'magenta');
                    resolve();
                }
            })
        })
    }
    models.quiz.findAll({raw: true})
    .then(quizzes => {
        toBeResolved = quizzes;
    })
    .then(() => {
        return playOne();
    })
    .catch(error => {
        console.log(error);
    })
    .then(() => {
        biglog(`${score}`, 'magenta');
        rl.prompt();
    })

};

exports.creditsCmd = rl => {
    log('Autores de la práctica:');
    log('Ignacio Mata Alonso', 'green');
    rl.prompt();
};

exports.quitCmd = rl => {
    rl.close();
};