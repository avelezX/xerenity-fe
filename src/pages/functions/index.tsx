
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown,
  faArrowUp,
  faDownload,
  faEllipsisVertical,
  faMars,
  faSearch,
  faUsers,
  faVenus,
} from '@fortawesome/free-solid-svg-icons'
import {
  Button, ButtonGroup, Card, Dropdown, ProgressBar,
} from 'react-bootstrap'
import { Bar, Line } from 'react-chartjs-2'
import {
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import React from 'react'

import FunctionsViewer from '@components/functions/FunctionsViewer'


Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler)
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)


const Home: NextPage = () => (
  
  <AdminLayout>
      <FunctionsViewer ></FunctionsViewer>
  </AdminLayout>
)

export default Home