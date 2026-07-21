import axios from "axios";

const BASE_URL = 'http://localhost:4000'

export const axiosWithCreds = axios.create({
    baseURL: BASE_URL,
    withCredentials: true
})
export const axiosWithoutCreds = axios.create({
    baseURL: BASE_URL,
})

const responseErrorHandler = (error) => {
 error.message =
    error.response?.data?.message ||
    error.message ||
    "Something went wrong";

  return Promise.reject(error);
};

axiosWithCreds.interceptors.response.use(
  (response) => response,
  responseErrorHandler
);

axiosWithoutCreds.interceptors.response.use(
  (response) => response,
  responseErrorHandler
);