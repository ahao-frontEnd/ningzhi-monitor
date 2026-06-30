import { Login as LoginPage } from '@/pages/Account/Login'

export const description =
  "A login page with two columns. The first column has the login form with email and password. There's a Forgot your password link and a link to sign up if you do not have an account. The second column has a cover image."

export function Login() {
  return <LoginPage />
}
