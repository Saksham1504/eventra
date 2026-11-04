'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Feedback = {
  message: string
} | null

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EventraLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim()
    const nextEmailError = !normalizedEmail
      ? 'Enter your campus email address.'
      : !emailPattern.test(normalizedEmail)
        ? 'Enter a valid email address.'
        : ''
    const nextPasswordError = password.length === 0 ? 'Enter your password.' : ''

    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setFeedback(null)

    if (nextEmailError || nextPasswordError) {
      return
    }

    setFeedback({
      message: 'Your details look good. Connect Eventra authentication to finish signing in.',
    })
  }

  const showProviderMessage = (message: string) => {
    setFeedback({ message })
  }

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field className="gap-2" data-invalid={Boolean(emailError)}>
          <FieldLabel htmlFor="eventra-email" className="text-sm font-medium text-foreground">
            School email
          </FieldLabel>
          <Input
            id="eventra-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            placeholder="you@university.edu"
            value={email}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'eventra-email-error' : undefined}
            className="h-12 rounded-xl border-border/80 bg-white px-4 text-[15px] shadow-none placeholder:text-muted-foreground/65 focus-visible:border-primary/50 focus-visible:ring-primary/15"
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailError('')
              setFeedback(null)
            }}
          />
          {emailError && <FieldError id="eventra-email-error">{emailError}</FieldError>}
        </Field>

        <Field className="gap-2" data-invalid={Boolean(passwordError)}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="eventra-password" className="text-sm font-medium text-foreground">
              Password
            </FieldLabel>
            <button
              type="button"
              className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() =>
                showProviderMessage('Password recovery is available once email authentication is connected.')
              }
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="eventra-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'eventra-password-error' : undefined}
              className="h-12 rounded-xl border-border/80 bg-white px-4 pr-14 text-[15px] shadow-none placeholder:text-muted-foreground/65 focus-visible:border-primary/50 focus-visible:ring-primary/15"
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError('')
                setFeedback(null)
              }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              aria-controls="eventra-password"
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordError && <FieldError id="eventra-password-error">{passwordError}</FieldError>}
        </Field>
      </FieldGroup>

      <Field orientation="horizontal" className="items-center gap-2.5">
        <Checkbox
          id="eventra-remember"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked === true)}
        />
        <FieldLabel
          htmlFor="eventra-remember"
          className="cursor-pointer text-sm font-normal leading-none text-muted-foreground"
        >
          Keep me signed in on this device
        </FieldLabel>
      </Field>

      <Button
        type="submit"
        className="h-12 w-full justify-between rounded-xl px-4 text-sm font-semibold shadow-[0_12px_22px_-15px_rgba(38,58,115,0.65)] transition-transform hover:-translate-y-0.5"
      >
        Sign in to Eventra
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>

      <FieldSeparator className="my-0 text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
        or continue with
      </FieldSeparator>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl border-border/80 bg-white font-medium text-foreground shadow-none hover:bg-white"
        onClick={() =>
          showProviderMessage('Google sign-in will work once Eventra authentication is connected.')
        }
      >
        <span
          aria-hidden="true"
          className="mr-1 grid size-5 place-items-center rounded-full border border-border text-[13px] font-bold text-[#4285f4]"
        >
          G
        </span>
        Continue with Google
      </Button>

      {feedback && (
        <p role="status" aria-live="polite" className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{feedback.message}</span>
        </p>
      )}
    </form>
  )
}
