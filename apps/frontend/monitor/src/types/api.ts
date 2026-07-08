export interface CreateUserPayload {
  username: string
  password: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginRes {
  data: {
    access_token: string
  }
}

export interface CurrentUserRes {
  data: {
    username: string
    email: string
  }
}
