import React from 'react'
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import SeriesViewer from '@components/banrep/SerieViwers'

const Home: NextPage = () => (
  
  <AdminLayout>
      <SeriesViewer />
  </AdminLayout>
)

export default Home
