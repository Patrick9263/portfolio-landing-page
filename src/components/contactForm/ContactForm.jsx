import { useState } from 'react'
import './ContactForm.css'

const ContactForm = () => {
  const [status, setStatus] = useState('')
  const [emailText, setEmailText] = useState('')
  const [messageText, setMessageText] = useState('')

  const submitForm = (ev) => {
    ev.preventDefault()
    const form = ev.target
    const data = new FormData(form)
    const xhr = new XMLHttpRequest()

    xhr.open(form.method, form.action)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return

      if (xhr.status === 200) {
        setEmailText('')
        setMessageText('')
        form.reset()
        setStatus('SUCCESS')
      } else {
        setStatus('ERROR')
      }
    }

    xhr.send(data)
  }

  const handleEmailChange = (event) => {
    setEmailText(String(event.target.value))
  }

  const handleMessageChange = (event) => {
    setMessageText(String(event.target.value))
  }

  return (
    <div className="contact-form-wrapper">
      <form
        className="contact-form"
        onSubmit={submitForm}
        action="https://formspree.io/f/xayvjzbj"
        method="POST"
      >
        <label className="contact-label" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          className="contact-field"
          type="email"
          name="email"
          value={emailText}
          onChange={handleEmailChange}
        />

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
        />

        {status === 'SUCCESS' ? (
          <p className="email-success">Thanks!</p>
        ) : (
          <button className="contact-submit" type="submit">
            Submit
          </button>
        )}

        {status === 'ERROR' && <p>Ooops! There was an error.</p>}
      </form>
    </div>
  )
}

export default ContactForm
