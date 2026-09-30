import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { getLocale } from '@/lib/locale'
import { LoginForm } from './login-form'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).admin.loginTitle }
}

export default async function AdminLoginPage() {
  const t = getMessages(await getLocale()).admin
  return (
    <article className="page page-narrow">
      <h1>{t.loginTitle}</h1>
      <p className="lead">{t.loginIntro}</p>
      <LoginForm
        labels={{
          email: t.email,
          password: t.password,
          submit: t.submit,
          errors: {
            invalid: t.loginFailed,
            rate_limited: t.loginRateLimited,
            disabled: t.loginDisabled,
            unavailable: t.loginUnavailable,
          },
        }}
      />
    </article>
  )
}
