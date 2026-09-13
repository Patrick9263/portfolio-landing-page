import { useState } from 'react'
import './Home.css'
import Fade from '../react-reveal/in-and-out/Fade'
import Bounce from '../react-reveal/in-and-out/Bounce'
import Typewriter from 'typewriter-effect'
import Navbar from '../navbar/Navbar'
import useReducedMotion from '../../hooks/useReducedMotion'
import profile from '../../images/patrick.png'
import profileAvif from '../../images/patrick-240.avif'
import profileWebp from '../../images/patrick-240.webp'
import linkedin from '../../images/social/linkedin.png'
import github from '../../images/social/github.png'

const Home = () => {
  const [profileStatus, setProfileStatus] = useState('loading')
  const prefersReducedMotion = useReducedMotion()

  return (
    <header className="home-wrapper" id="home">
      <div className="home">
        <div className="greeting">
          <Fade bottom distance="40px">
            <div className={`profile-frame profile-frame--${profileStatus}`}>
              <span className="profile-fallback" aria-hidden="true">
                PS
              </span>
              <picture>
                <source type="image/avif" srcSet={profileAvif} />
                <source type="image/webp" srcSet={profileWebp} />
                <img
                  className="profile"
                  alt="Patrick Smith profile"
                  src={profile}
                  width="120"
                  height="120"
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setProfileStatus('loaded')}
                  onError={() => setProfileStatus('error')}
                />
              </picture>
            </div>

            <h1 className="hi-greeting-text" id="home-heading">
              Hi, I&apos;m <span className="name">Patrick Smith</span>.{' '}
            </h1>

            <p className="greeting-text">
              {prefersReducedMotion ? (
                "I'm a software engineer."
              ) : (
                <Typewriter
                  component="span"
                  options={{
                    strings: [
                      "I'm a software engineer.",
                      'I like to design websites.',
                      'I love learning new tech.',
                    ],
                    autoStart: true,
                    loop: true,
                    deleteSpeed: 10,
                    cursor: '<',
                    delay: 100,
                  }}
                />
              )}
            </p>

            <div className="home-link-container">
              <Bounce cascade>
                <div className="home-links">
                  <a
                    href="https://github.com/Patrick9263/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img src={github} alt="Github Logo" width="50px" />
                  </a>
                </div>
              </Bounce>

              <Bounce cascade>
                <div className="home-links">
                  <a
                    href="https://www.linkedin.com/in/patrick-smith1/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img src={linkedin} alt="LinkedIn Logo" width="50px" />
                  </a>
                </div>
              </Bounce>
            </div>
          </Fade>

          <div className="scroll-down">
            <a href="#about" aria-label="Go to About section">
              <svg
                className="scroll-down-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14.5L6.5 11l1.4-1.4 4.1 4.1 4.1-4.1L17.5 11 12 16.5Z" />
              </svg>
            </a>
          </div>
        </div>

        <Navbar />
      </div>
    </header>
  )
}

export default Home
