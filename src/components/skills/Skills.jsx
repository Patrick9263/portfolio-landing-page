import React, { useEffect, useRef, useState } from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import { skills } from '../../data/skills.js'

const Skills = () => {
  const wrapperRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = wrapperRef.current

    if (!node || isVisible) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.2,
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVisible])

  return (
    <Fade duration={1000}>
      <div
        ref={wrapperRef}
        className="skills-wrapper"
        style={
          isVisible
            ? {
                transition: '1s opacity ease-in-out',
                transform: 'translateX(0)',
                opacity: 1,
              }
            : {
                opacity: 0,
              }
        }
      >
        <h2>Skills</h2>
        <ul className="skills">
          {skills.map((skill) => (
            <li className="skill-bar-wrapper" key={skill.skillName}>
              <div
                className="skill-bar"
                style={
                  isVisible
                    ? {
                        transition: `${1 + skill.id / 10}s width ease-in-out`,
                        width: `${skill.amount}%`,
                      }
                    : {
                        width: 1,
                      }
                }
              ></div>
              <div className="skill-name">{skill.skillName}</div>
            </li>
          ))}
        </ul>
      </div>
    </Fade>
  )
}

export default Skills
