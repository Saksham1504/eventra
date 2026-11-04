'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Info, LoaderCircle } from 'lucide-react'
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
import {
  getEventraAuthErrorMessage,
  sendEventraPasswordReset,
  signInWithEventraEmail,
  signInWithEventraGoogle,
} from '@/lib/eventra-auth'

type Feedback = {
  message: string
  tone?: 'error' | 'success'
} | null

type ActiveAction = 'email' | 'google' | 'reset' | null

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EventraLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    setActiveAction('email')
    try {
      const user = await signInWithEventraEmail(normalizedEmail, password, rememberMe)
      setFeedback({ message: `Welcome back, ${user.name}.`, tone: 'success' })
    } catch (error) {
      setFeedback({ message: getEventraAuthErrorMessage(error), tone: 'error' })
    } finally {
      setActiveAction(null)
    }
  }

  const handleGoogleSignIn = async () => {
    setActiveAction('google')
    try {
      const user = await signInWithEventraGoogle(rememberMe)
      setFeedback({ message: `Welcome back, ${user.name}.`, tone: 'success' })
    } catch (error) {
      setFeedback({ message: getEventraAuthErrorMessage(error), tone: 'error' })
    } finally {
      setActiveAction(null)
    }
  }

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim()
    if (!emailPattern.test(normalizedEmail)) {
      setEmailError('Enter a valid email address first.')
      setFeedback(null)
      return
    }

    setEmailError('')
    setActiveAction('reset')
    try {
      await sendEventraPasswordReset(normalizedEmail)
      setFeedback({ message: 'Password reset instructions have been sent to your email.', tone: 'success' })
    } catch (error) {
      setFeedback({ message: getEventraAuthErrorMessage(error), tone: 'error' })
    } finally {
      setActiveAction(null)
    }
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
            disabled={activeAction !== null}
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
              disabled={activeAction !== null}
              className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void handlePasswordReset()}
            >
              {activeAction === 'reset' ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>
          <div className="relative">
            <Input
              id="eventra-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={activeAction !== null}
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
          disabled={activeAction !== null}
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
        disabled={activeAction !== null}
        className="h-12 w-full justify-between rounded-xl px-4 text-sm font-semibold shadow-[0_12px_22px_-15px_rgba(38,58,115,0.65)] transition-transform hover:-translate-y-0.5"
      >
        {activeAction === 'email' ? 'Signing in...' : 'Sign in to Eventra'}
        {activeAction === 'email' ? (
          <LoaderCircle data-icon="inline-end" className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        )}
      </Button>

      <FieldSeparator className="my-0 text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
        or continue with
      </FieldSeparator>

      <Button
        type="button"
        variant="outline"
        disabled={activeAction !== null}
        className="h-12 w-full rounded-xl border-border/80 bg-white font-medium text-foreground shadow-none hover:bg-white"
        onClick={() => void handleGoogleSignIn()}
      >
        {activeAction === 'google' ? (
          <LoaderCircle className="mr-1 size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="mr-1 grid size-5 place-items-center rounded-full border border-border text-[13px] font-bold text-[#4285f4]"
          >
            G
          </span>
        )}
        {activeAction === 'google' ? 'Connecting...' : 'Continue with Google'}
      </Button>

      {feedback && (
        <p
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
          className={`flex items-start gap-2 text-sm leading-5 ${
            feedback.tone === 'error' ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{feedback.message}</span>
        </p>
      )}
    </form>
  )
}
