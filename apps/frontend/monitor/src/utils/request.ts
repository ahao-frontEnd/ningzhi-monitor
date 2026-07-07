import axios, { CreateAxiosDefaults } from 'axios'

const config: CreateAxiosDefaults = {
  baseURL: '/api',
  timeout: 5000,
}

export const request = axios.create(config)

request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.token = token
  }
  return config
})

request.interceptors.response.use(
  response => {
    return response
  },
  error => {
    // 如果是401错误，跳转到登录页
    if (error.response.status === 401) {
      window.location.href = '/account/login'
    }
    return Promise.reject(error)
  }
)
