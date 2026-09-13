import { useEffect, useRef, useState } from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import { skills } from '../../data/skills.js'
import useReducedMotion from '../../hooks/useReducedMotion'

const Skills = () => {
  const wrapperRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldShow = isVisible || prefersReducedMotion

  useEffect(() => {
    const node = wrapperRef.current

    if (!node || isVisible || prefersReducedMotion) {
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
  }, [isVisible, prefersReducedMotion])

  return (
    <Fade duration={1000}>
      <div
        ref={wrapperRef}
        className="skills-wrapper"
        style={
          shouldShow
            ? {
                transition: prefersReducedMotion
                  ? 'none'
                  : '1s opacity ease-in-out',
                transform: 'translateX(0)',
                opacity: 1,
              }
            : {
                opacity: 0,
              }
        }
      >
        <h3>Skills</h3>
        <ul className="skills">
          {skills.map((skill) => (
            <li className="skill-bar-wrapper" key={skill.skillName}>
              <div
                className="skill-bar"
                style={
                  shouldShow
                    ? {
                        transition: prefersReducedMotion
                          ? 'none'
                          : `${1 + skill.id / 10}s width ease-in-out`,
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
