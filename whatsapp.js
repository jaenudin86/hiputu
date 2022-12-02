import { existsSync, unlinkSync, readdir } from 'fs'
import { join } from 'path'

import pino from 'pino'
import makeWASocket, {
    makeWALegacySocket,
    useSingleFileAuthState,
    useSingleFileLegacyAuthState,
    makeInMemoryStore,
    Browsers,
    DisconnectReason,
    delay,
} from '@adiwajshing/baileys'
import { toDataURL } from 'qrcode'
import __dirname from './dirname.js'
import response from './response.js'
import { db,sdb8 }  from './database/Database.js'


const sessions = new Map()
const retries = new Map()

const sessionsDir = (sessionId = '') => {
    return join(__dirname, 'sessions', sessionId ? `${sessionId}.json` : '')
}

const isSessionExists = (sessionId) => {
    return sessions.has(sessionId)
}

const isSessionFileExists = (name) => {
    return existsSync(sessionsDir(name))
}

const shouldReconnect = (sessionId) => {
    let maxRetries = parseInt(process.env.MAX_RETRIES ?? 0)
    let attempts = retries.get(sessionId) ?? 0

    maxRetries = maxRetries < 1 ? 1 : maxRetries

    if (attempts < maxRetries) {
        ++attempts

        console.log('Reconnecting...', { attempts, sessionId })
        retries.set(sessionId, attempts)

        return true
    }

    return false
}

const createSession = async (sessionId, isLegacy = false, res = null) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId

    const logger = pino({ level: 'warn' })
    const store = makeInMemoryStore({ logger })

    const { state, saveState } = isLegacy
        ? useSingleFileLegacyAuthState(sessionsDir(sessionFile))
        : useSingleFileAuthState(sessionsDir(sessionFile))

    /**
     * @type {import('@adiwajshing/baileys').CommonSocketConfig}
     */
    const waConfig = {
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: Browsers.ubuntu('Chrome'),
    }

    /**
     * @type {import('@adiwajshing/baileys').AnyWASocket}
     */
    const wa = isLegacy ? makeWALegacySocket(waConfig) : makeWASocket.default(waConfig)

    if (!isLegacy) {
        store.readFromFile(sessionsDir(`${sessionId}_store`))
        store.bind(wa.ev)
    }

    sessions.set(sessionId, { ...wa, store, isLegacy })

    wa.ev.on('creds.update', saveState)

    wa.ev.on('chats.set', ({ chats }) => {
        if (isLegacy) {
            store.chats.insertIfAbsent(...chats)
        }
    })

    // Automatically read incoming messages, uncomment below codes to enable this behaviour

    wa.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0]

        if (!message.key.fromMe && m.type === 'notify') {
            await delay(1000)

            const number = phoneNumberFormatter(message.key.remoteJid)
          console.log(number);
          console.log(message.message.conversation);
	const text = message.message.conversation;
	if(message.message.conversation === null )
        {
		text = message.message.extendedTextMessage.text;
        }


// message.message.extendedTextMessage.text;

            const mynumber = number.replace(/\D/g, '')
            const texte = text.toLowerCase()
            console.log(mynumber)
            console.log(texte)
            db.query(`select * from autoreply a left join group_kontak_d b on a.group_id =  b.kontak_id left join contact c on b.kontak = c.id    WHERE LOWER(keyword) = "${texte}" and  c.number = "${mynumber}"  `, async (err, results) => {
                if (err) throw err;
                if (results.length === 0) return;
                if (!results[0].media) {
                    if(!results[0].query)
                    {

                        wa.sendMessage(message.key.remoteJid, { text: results[0].response})

                    }
                    else
                    {
                        var dbs = "";
                        db.query(`SELECT * FROM query join koneksi on query.connection = koneksi.id  WHERE query.id = "${results[0].query}"`, async (err, results2) => {

                        if(results2[0].koneksi == 'sdb8')
                        {
                            dbs = sdb8;

                        }
                        else if(results2[0].koneksi == 'sdb3')
                        {
                            dbs = sdb8;

                        }
                            dbs.query(`${results2[0].query}`, async (err1, results3) => {

                                console.log(err1)
                                let nilai = '';
                                let hasil = '';
                                let html  = results2[0].format
                                console.log(results3.recordset)
                                for(var prop in results3.recordset  )
                                {
                                    for(var prove in results3.recordset[prop] )
                                    {
                                        console.log(prove,results3.recordset[prop][prove]);
                                        console.log(prove + " -> " + results3.recordset[prop][prove]);
                                        nilai = prove;
                                        hasil += results3.recordset[prop][prove] + '\r\n'

                                    }
                                }
                                // }
                                console.log('['+nilai+']');

				var today = new Date();
				var dd = String(today.getDate()).padStart(2, '0');
				var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
				var yyyy = today.getFullYear();
                                console.log(hasil);
				today = mm + '/' + dd + '/' + yyyy;
                                let result = html.replace('['+nilai+']', hasil);
				let result2 = result.replace('Hari',today);
                wa.sendMessage(message.key.remoteJid, { text: result2})

                            })

                            // client.sendMessage(sender, results[0].response, MessageType.text);
                        })
                    }
                } else {
                    const url = results[0].media;
                    const file = url.split("/");
                    const namefile = file[file.length - 1];
                    const explodename = namefile.split(".");
                    const typefile = explodename[1];

                    switch (typefile) {
                        case 'jpg':
                        case 'png':
                        case 'jpeg':
                            client.sendMessage(sender, { url: url }, MessageType.image, { caption: results[0].response }).catch(err => {
                                console.log('Gagal balas pesan')
                            })
                            break;
                        case 'pdf':
                        case 'doc':
                        case 'docx':
                            try {
                                //console.log(url)
                                const response = await axios.get(url, { responseType: 'arraybuffer' });
                                const buffer = Buffer.from(response.data, "utf-8");
                                client.sendMessage(sender, buffer, MessageType.document, {
                                    filename: namefile,
                                    mimetype: typefile
                                })
                            } catch (err) {
                                console.log("gagal" + err)
                            }
                    }
                }
            })

            // await wa.sendMessage(message.key.remoteJid, { text: `Sistem otomatis block!\nJangan menelpon bot!\nSilahkan Hubungi Owner Untuk Dibuka !`})
            if (isLegacy) {
                await wa.chatRead(message.key, 1)
            } else {
                await wa.sendReadReceipt(message.key.remoteJid, message.key.participant, [message.key.id])
            }
        }
    })
    wa.ws.on('CB:call', async (json) => {
        const callerId = json.content[0].attrs['call-creator']
        if (json.content[0].tag == 'offer') {
        await wa.sendMessage(callerId, { text: `Sistem otomatis block!\nJangan menelpon bot!\nSilahkan Hubungi Owner Untuk Dibuka !`})

        }
    })
    wa.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        const statusCode = lastDisconnect?.error?.output?.statusCode

        if (connection === 'open') {
            retries.delete(sessionId)
        }

        if (connection === 'close') {
            if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
                if (res && !res.headersSent) {
                    response(res, 500, false, 'Unable to create session.')
                }

                return deleteSession(sessionId, isLegacy)
            }

            setTimeout(
                () => {
                    createSession(sessionId, isLegacy, res)
                },
                statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 0)
            )
        }

        if (update.qr) {
            if (res && !res.headersSent) {
                try {
                    const qr = await toDataURL(update.qr)

                    response(res, 200, true, 'QR code received, please scan the QR code.', { qr })

                    return
                } catch {
                    response(res, 500, false, 'Unable to create QR code.')
                }
            }

            try {
                await wa.logout()
            } catch {
            } finally {
                deleteSession(sessionId, isLegacy)
            }
        }
    })
}

/**
 * @returns {(import('@adiwajshing/baileys').AnyWASocket|null)}
 */
const getSession = (sessionId) => {
    return sessions.get(sessionId) ?? null
}

const deleteSession = (sessionId, isLegacy = false) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId
    const storeFile = `${sessionId}_store`

    if (isSessionFileExists(sessionFile)) {
        unlinkSync(sessionsDir(sessionFile))
    }

    if (isSessionFileExists(storeFile)) {
        unlinkSync(sessionsDir(storeFile))
    }

    sessions.delete(sessionId)
    retries.delete(sessionId)
}

const getChatList = (sessionId, isGroup = false) => {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net'

    return getSession(sessionId).store.chats.filter((chat) => {
        return chat.id.endsWith(filter)
    })
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const isExists = async (session, jid, isGroup = false) => {
    try {
        let result

        if (isGroup) {
            result = await session.groupMetadata(jid)

            return Boolean(result.id)
        }

        if (session.isLegacy) {
            result = await session.onWhatsApp(jid)
        } else {
            ;[result] = await session.onWhatsApp(jid)
        }

        return result.exists
    } catch {
        return false
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const sendMessage = async (session, receiver, message) => {
    try {
        await delay(1000)

        return session.sendMessage(receiver, message)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}
const phoneNumberFormatter = function (number) {
    // 1. Menghilangkan karakter selain angka
    if (number.endsWith('@g.us')) {
        return number
    }
    let formatted = number.replace(/\D/g, '');

    // 2. Menghilangkan angka 0 di depan (prefix)
    //    Kemudian diganti dengan 62
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substr(1);
    }

    if (!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }

    return formatted;
}
const formatPhone = (phone) => {
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone
    }

    let formatted = phone.replace(/\D/g, '')

    return (formatted += '@s.whatsapp.net')
}

const formatGroup = (group) => {
    if (group.endsWith('@g.us')) {
        return group
    }

    let formatted = group.replace(/[^\d-]/g, '')

    return (formatted += '@g.us')
}

const cleanup = () => {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
        if (!session.isLegacy) {
            session.store.writeToFile(sessionsDir(`${sessionId}_store`))
        }
    })
}

const init = () => {
    readdir(sessionsDir(), (err, files) => {
        if (err) {
            throw err
        }

        for (const file of files) {
            if (
                !file.endsWith('.json') ||
                (!file.startsWith('md_') && !file.startsWith('legacy_')) ||
                file.includes('_store')
            ) {
                continue
            }

            const filename = file.replace('.json', '')
            const isLegacy = filename.split('_', 1)[0] !== 'md'
            const sessionId = filename.substring(isLegacy ? 7 : 3)

            createSession(sessionId, isLegacy)
        }
    })
}

export {
    isSessionExists,
    createSession,
    getSession,
    deleteSession,
    getChatList,
    isExists,
    sendMessage,
    formatPhone,
    formatGroup,
    cleanup,
    init,
}
