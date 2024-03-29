import React from 'react'
import './Experience.css'
import Fade from '../react-reveal/in-and-out/Fade'
import Section from '../section/Section'
import ExperienceCard from '../experienceCard/ExperienceCard'
import experienceData from '../../data/experience.json'

const Experience = () => {
  return (
    <Section title="Experience">
      <div className="experience-content">
        <ul className="experience-list">
          {experienceData.experience.reverse().map((exp, i) => (
            <li key={`experience-${exp.company}${i}`}>
              <Fade bottom duration={1000} distance="20px">
                <ExperienceCard experience={exp} companyColor={exp.companyColor} />
              </Fade>
            </li>
          ))}
        </ul>
        <Fade bottom duration={1200} distance="20px">
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <p style={{ textAlign: 'center' }}>
              Further in-depth experience can be found on my{' '}
              <a
                href="https://www.linkedin.com/in/patrick-smith1/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textDecoration: 'none',
                  color: '#1bdbdb',
                  cursor: 'pointer',
                }}
              >
                LinkedIn
              </a>
              .
            </p>
          </div>
        </Fade>
      </div>
    </Section>
  )
}

export default Experience
