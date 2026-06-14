import React, { useEffect, useRef, useState } from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import { skills } from '../../data/skills.js'
import { useContainerDimensions } from '../../hooks'

const Skills = () => {
  const skillsWrapper = useRef(null)
  const visibilityRef = useRef(null)
  const [isVisibleSkillsWrapper, setIsVisibleSkillsWrapper] = useState(false)
  const { width } = useContainerDimensions(skillsWrapper)

  useEffect(() => {
    const node = visibilityRef.current

    if (!node || isVisibleSkillsWrapper) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisibleSkillsWrapper(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.2,
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVisibleSkillsWrapper])

  return (
    <Fade duration={1000}>
      <div
        ref={visibilityRef}
        style={{ position: 'relative', width: '100%', maxWidth: 600 }}
      >
        <div
          className="skills-wrapper"
          style={
            isVisibleSkillsWrapper
              ? {
                  transition: '1s opacity ease-in-out',
                  transform: 'translateX(0)',
                  opacity: 1,
                }
              : {}
          }
        >
          <h2>Skills</h2>
          <ul className="skills" ref={skillsWrapper}>
            {skills.map((skill) => (
              <li className="skill-bar-wrapper" key={skill.skillName}>
                <div
                  className="skill-bar"
                  style={
                    isVisibleSkillsWrapper
                      ? {
                          transition: `${1 + skill.id / 10}s width ease-in-out`,
                          width: width * (skill.amount / 100),
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
      </div>
    </Fade>
  )
}

export default Skills
