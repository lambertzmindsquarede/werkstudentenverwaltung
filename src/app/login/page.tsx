import Image from 'next/image'
import { MicrosoftSignInButton } from '@/components/MicrosoftSignInButton'
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2 pt-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-xl px-6 py-3 shadow-lg">
                <Image
                  src="/mindsquare-logo.svg"
                  alt="mindsquare"
                  width={160}
                  height={38}
                  priority
                />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-white">
              Werkstudentenverwaltung
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm mt-1">
              Melde dich mit deinem mindsquare-Konto an
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <Separator className="bg-white/10 mb-6" />
            {errorMessage && (
              <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-500/10 text-red-400">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <MicrosoftSignInButton />
            <p className="text-xs text-slate-500 text-center mt-6">
              Nur für mindsquare-Mitarbeiter zugänglich.
              <br />
              Bei Problemen wende dich an die IT.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} mindsquare AG
        </p>
      </div>
    </main>
  )
}
