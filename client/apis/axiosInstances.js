import axios from "axios";

const BASE_URL = process.env.VITE_BACKEND_BASE_URL

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