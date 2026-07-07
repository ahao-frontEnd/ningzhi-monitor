import bcrypt from 'bcryptjs'

const saltRounds = '$2a$10$j08v6qUb20lAUMyyG2d0TO' //

export const encrypt = async (password: string) => bcrypt.hash(password, saltRounds)

export const encryptCompare = async (password: string, hash: string) => bcrypt.compare(password, hash)
