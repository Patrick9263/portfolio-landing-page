import { useRef, useState } from 'react'
import './ContactForm.css'

const CONTACT_FORM_ENDPOINT =
  import.meta.env.VITE_CONTACT_FORM_ENDPOINT ||
  'https://formspree.io/f/xayvjzbj'
const REQUEST_TIMEOUT_MS = 10000

const ContactForm = () => {
  const [submissionState, setSubmissionState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: '', message: '' })
  const [emailText, setEmailText] = useState('')
  const [messageText, setMessageText] = useState('')
  const emailInput = useRef(null)
  const submissionInFlight = useRef(false)

  const resetFeedbackForEdit = () => {
    if (submissionState === 'submitting' || submissionState === 'idle') return

    setSubmissionState('idle')
    setStatusMessage('')
  }

  const validateFields = () => {
    const emailError = !emailText.trim()
      ? 'Enter your email address.'
      : emailInput.current?.validity.valid
        ? ''
        : 'Enter a valid email address.'
    const messageError = messageText.trim() ? '' : 'Enter a message.'
    const errors = { email: emailError, message: messageError }

    setFieldErrors(errors)
    return !emailError && !messageError
  }

  const submitForm = async (event) => {
    event.preventDefault()
    if (submissionInFlight.current) return

    if (!validateFields()) {
      setSubmissionState('error')
      setStatusMessage('Please correct the highlighted fields and try again.')
      return
    }

    submissionInFlight.current = true
    setSubmissionState('submitting')
    setStatusMessage('Sending your message…')

    const form = event.currentTarget
    const data = new FormData(form)
    data.set('email', emailText.trim())
    data.set('message', messageText.trim())

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: data,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (response.ok) {
        setEmailText('')
        setMessageText('')
        setFieldErrors({ email: '', message: '' })
        setSubmissionState('success')
        setStatusMessage('Thanks! Your message was sent.')
      } else {
        setSubmissionState('error')
        setStatusMessage(
          response.status === 429
            ? 'Too many messages were sent recently. Please wait and try again.'
            : 'The form service could not accept your message. Please try again.'
        )
      }
    } catch (error) {
      setSubmissionState('error')
      setStatusMessage(
        error.name === 'AbortError'
          ? 'Sending took too long. Your message was not sent; please try again.'
          : 'Could not reach the form service. Check your connection and try again.'
      )
    } finally {
      clearTimeout(timeout)
      submissionInFlight.current = false
    }
  }

  const handleEmailChange = (event) => {
    setEmailText(String(event.target.value))
    setFieldErrors((errors) => ({ ...errors, email: '' }))
    resetFeedbackForEdit()
  }

  const handleMessageChange = (event) => {
    setMessageText(String(event.target.value))
    setFieldErrors((errors) => ({ ...errors, message: '' }))
    resetFeedbackForEdit()
  }

  const isSubmitting = submissionState === 'submitting'

  return (
    <div className="contact-form-wrapper">
      <form
        className="contact-form"
        onSubmit={submitForm}
        action={CONTACT_FORM_ENDPOINT}
        method="POST"
        noValidate
        aria-busy={isSubmitting}
      >
        <label className="contact-label" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          className="contact-field"
          type="email"
          name="email"
          ref={emailInput}
          value={emailText}
          onChange={handleEmailChange}
          autoComplete="email"
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={
            fieldErrors.email ? 'contact-email-error' : undefined
          }
        />
        {fieldErrors.email && (
          <p id="contact-email-error" className="contact-field-error">
            {fieldErrors.email}
          </p>
        )}

        <label className="contact-label" htmlFor="contact-message">
          Message
        </label>
        <textarea
          id="contact-message"
          className="contact-field contact-message"
          name="message"
          value={messageText}
          onChange={handleMessageChange}
          rows="5"
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={
            fieldErrors.message ? 'contact-message-error' : undefined
          }
        />
        {fieldErrors.message && (
          <p id="contact-message-error" className="contact-field-error">
            {fieldErrors.message}
          </p>
        )}

        <button
          className="contact-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending…' : 'Submit'}
        </button>

        <p
          className={`contact-status contact-status--${submissionState}`}
          role={submissionState === 'error' ? 'alert' : 'status'}
          aria-live={submissionState === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {statusMessage}
        </p>
      </form>
    </div>
  )
}

export default ContactForm
