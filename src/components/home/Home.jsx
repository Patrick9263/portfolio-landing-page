import React, { useState } from 'react'
import './Home.css'
import Fade from '../react-reveal/in-and-out/Fade'
import Bounce from '../react-reveal/in-and-out/Bounce'
import { Link } from 'react-scroll'
// import Particles from 'react-particles-js'
import Typewriter from 'typewriter-effect'
import Navbar from '../navbar/Navbar'
// import config from '../../config'
import profile from '../../images/patrick.png'
import linkedin from '../../images/social/linkedin.png'
import github from '../../images/social/github.png'

const Home = () => {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div className="home-wrapper">
      <div className="home">
        {/* <Particles className="particles" params={config.particles} /> */}

        <div className={`greeting${!imageLoaded ? ' hide' : ''}`}>
          <Fade bottom distance="40px">
            <img
              className="profile"
              alt="Patrick Smith profile"
              src={profile}
              onLoad={() => setImageLoaded(true)}
            />

            <h1 className="hi-greeting-text">
              Hi, I'm <span className="name">Patrick Smith</span>.{' '}
            </h1>

            <h1 className="greeting-text">
              <Typewriter
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
            </h1>

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
            <Link
              activeClass="active"
              to="about"
              spy={true}
              smooth={true}
              offset={-63}
              duration={500}
            >
              <svg
                className="scroll-down-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14.5L6.5 11l1.4-1.4 4.1 4.1 4.1-4.1L17.5 11 12 16.5Z" />
              </svg>
            </Link>
          </div>
        </div>

        <Navbar />
      </div>
    </div>
  )
}

export default Home
