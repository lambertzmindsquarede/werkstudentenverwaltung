import Image from 'next/image'
import { MicrosoftSignInButton } from '@/components/MicrosoftSignInButton'
import { DevLoginButton } from '@/components/DevLoginButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
  missing_code: 'Ungültiger Anmelde-Link. Bitte starte die Anmeldung erneut.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Ein unbekannter Fehler ist aufgetreten.') : null
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === 'true'

  return (
    <main className="min-h-screen flex items-center justify-center relative p-4 bg-[url('/login-bg.jpg')] bg-cover bg-center">
      {/* Subtle overlay for card readability */}
      <div className="absolute inset-0 bg-white/30" />

      <div className="relative w-full max-w-md">
        <Card className="border-slate-200 bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo-mindsquare-176x781.webp"
                alt="mindsquare"
                width={126}
                height={56}
                priority
              />
            </div>
            <CardTitle className="text-2xl font-semibold text-slate-900">
              Werkstudentenverwaltung
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm mt-1">
              Melde dich mit deinem mindsquare-Konto an
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <Separator className="bg-slate-200 mb-6" />
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <MicrosoftSignInButton />
            <DevLoginButton enabled={devLoginEnabled} />
            <p className="text-xs text-slate-500 text-center mt-6">
              Nur für mindsquare-Mitarbeiter zugänglich.
              <br />
              Bei Problemen wende dich an die IT.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-slate-700 text-xs mt-6 drop-shadow">
          © {new Date().getFullYear()} mindsquare AG
        </p>
      </div>
    </main>
  )
}
